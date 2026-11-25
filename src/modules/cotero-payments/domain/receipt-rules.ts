/**
 * Receipts of a cotero (the paper "recibo de caja menor"): the row as listed, the draft as typed or read
 * by the AI (all text), how a draft is validated into values, and the list filters and totals.
 */
import { matchesQuery } from "@/modules/shared/domain/search-key";
import { canonicalName, coteroKey, normalizeDocument } from "./cotero-identity";
import { parseCop, parseTons } from "./parse-values";
import { resolveFleetRefs, type FleetCandidates } from "./fleet-matching";
import { normalizeVehiclePlate } from "./plates";
import { normalizeReceiptNumber } from "./receipt-number";
import type { ReceiptStatus } from "./settlement-rules";
import { receiptFigures, type Tariff } from "./tariff";

export interface ReceiptRow {
  id: number;
  receiptNumber: string;
  date: string;
  destination: string;
  remissions: string[];
  tons: number;
  /** Stored form ("ABC123"); shown with `formatVehiclePlate`. */
  vehiclePlate: string;
  trailerPlate: string | null;
  crew: string | null;
  coteroKey: string;
  coteroName: string;
  coteroDocument: string | null;
  driverName: string;
  /** What is written on the receipt and gets paid, in whole pesos. */
  amount: number;
  tariffPerTon: number | null;
  expectedAmount: number | null;
  amountMismatch: boolean;
  /** Storage path of the original file; null for a receipt typed by hand without one. */
  filePath: string | null;
  pageNumber: number | null;
  status: ReceiptStatus;
  settlementId: number | null;
  settlementNumber: number | null;
}

/** The fields of a receipt as the form (or the AI reading) hands them over: all text. */
export interface ReceiptDraft {
  receiptNumber: string;
  /** ISO day. */
  date: string;
  destination: string;
  remissions: string;
  tons: string;
  vehiclePlate: string;
  trailerPlate: string;
  crew: string;
  coteroName: string;
  coteroDocument: string;
  driverName: string;
  amount: string;
}

export type DraftField = keyof ReceiptDraft;

export interface DraftIssue {
  field: DraftField;
  /**
   * "missing": required and blank. "invalid": written but not readable as that kind of value.
   * "not-in-fleet": a plate or driver that is not an active entry of the fleet.
   */
  kind: "missing" | "invalid" | "not-in-fleet";
}

/** A receipt validated and normalized, ready to store. */
export interface ReceiptValues {
  receiptNumber: string;
  date: string;
  destination: string;
  remissions: string[];
  tons: number;
  vehiclePlate: string;
  trailerPlate: string | null;
  crew: string | null;
  coteroName: string;
  coteroDocument: string | null;
  coteroKey: string;
  driverName: string;
  amount: number;
}

export const DRAFT_FIELD_LABELS: Record<DraftField, string> = {
  receiptNumber: "N.º de recibo",
  date: "Fecha",
  destination: "Destino",
  remissions: "Remisiones",
  tons: "Toneladas",
  vehiclePlate: "Placa",
  trailerPlate: "Placa del trailer",
  crew: "Cuadrilla",
  coteroName: "Cotero",
  coteroDocument: "Cédula",
  driverName: "Conductor",
  amount: "Liquidación",
};

const isRealIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Remission numbers are informational: every group of text with a digit in it, as written. */
const parseRemissions = (raw: string): string[] => raw.split(/[\s,;]+/).filter((token) => /\d/.test(token));

/** The empty draft of a receipt typed by hand. */
export const emptyDraft = (date = ""): ReceiptDraft => ({
  receiptNumber: "",
  date,
  destination: "",
  remissions: "",
  tons: "",
  vehiclePlate: "",
  trailerPlate: "",
  crew: "",
  coteroName: "",
  coteroDocument: "",
  driverName: "",
  amount: "",
});

/**
 * Validates and normalizes a draft. `values` is null while any `issues` remain. The destination, the
 * remissions, the trailer, the crew and the cédula are optional (that the plates and the driver exist in
 * the fleet is checked apart, by `resolveFleetRefs`).
 */
export function parseDraft(draft: ReceiptDraft): { values: ReceiptValues | null; issues: DraftIssue[] } {
  const issues: DraftIssue[] = [];

  const numberText = draft.receiptNumber.trim();
  const receiptNumber = numberText === "" ? null : normalizeReceiptNumber(numberText);
  if (numberText === "") issues.push({ field: "receiptNumber", kind: "missing" });
  else if (receiptNumber === null) issues.push({ field: "receiptNumber", kind: "invalid" });

  const date = draft.date.trim();
  if (date === "") issues.push({ field: "date", kind: "missing" });
  else if (!isRealIsoDate(date)) issues.push({ field: "date", kind: "invalid" });

  const tonsText = draft.tons.trim();
  const tons = tonsText === "" ? null : parseTons(tonsText);
  if (tonsText === "") issues.push({ field: "tons", kind: "missing" });
  else if (tons === null) issues.push({ field: "tons", kind: "invalid" });

  const vehiclePlate = normalizeVehiclePlate(draft.vehiclePlate);
  if (vehiclePlate === "") issues.push({ field: "vehiclePlate", kind: "missing" });

  const coteroName = canonicalName(draft.coteroName);
  if (coteroName === "") issues.push({ field: "coteroName", kind: "missing" });

  const driverName = canonicalName(draft.driverName);
  if (driverName === "") issues.push({ field: "driverName", kind: "missing" });

  const amountText = draft.amount.trim();
  const amount = amountText === "" ? null : parseCop(amountText);
  if (amountText === "") issues.push({ field: "amount", kind: "missing" });
  else if (amount === null) issues.push({ field: "amount", kind: "invalid" });

  const documentText = draft.coteroDocument.trim();
  const coteroDocument = normalizeDocument(documentText);
  if (documentText !== "" && coteroDocument === null) issues.push({ field: "coteroDocument", kind: "invalid" });

  if (issues.length > 0 || receiptNumber === null || tons === null || amount === null) return { values: null, issues };
  const key = coteroKey({ name: coteroName, document: coteroDocument });
  if (key === null) return { values: null, issues: [{ field: "coteroName", kind: "missing" }] };

  const trailerPlate = normalizeVehiclePlate(draft.trailerPlate);
  const crew = canonicalName(draft.crew);
  return {
    issues,
    values: {
      receiptNumber,
      date,
      destination: canonicalName(draft.destination),
      remissions: parseRemissions(draft.remissions),
      tons,
      vehiclePlate,
      trailerPlate: trailerPlate === "" ? null : trailerPlate,
      crew: crew === "" ? null : crew,
      coteroName,
      coteroDocument,
      coteroKey: key,
      driverName,
      amount,
    },
  };
}

/** The numbers that appear more than once in a batch (blanks ignored). */
export function duplicateNumbers(numbers: ReadonlyArray<string | null>): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const number of numbers) {
    if (number === null) continue;
    if (seen.has(number)) repeated.add(number);
    seen.add(number);
  }
  return repeated;
}

export interface DraftReview {
  issues: DraftIssue[];
  /** The receipt number is already stored ("database") or written twice in this batch ("batch"). */
  duplicate: "database" | "batch" | null;
  /** The written amount is far from tons times the tariff of that day. */
  mismatch: boolean;
  /** Missing, unreadable or duplicate: it cannot be saved until fixed. A mismatch alone does not block. */
  blocked: boolean;
}

/** What a reviewer must see about one draft of a batch. */
export function draftIssues(
  draft: ReceiptDraft,
  context: {
    existingNumbers: ReadonlySet<string>;
    batchDuplicates: ReadonlySet<string>;
    tariffs: readonly Tariff[];
    /** When given, a plate or a driver that is not in it is an issue that blocks saving. */
    fleet?: FleetCandidates;
  },
): DraftReview {
  const { issues } = parseDraft(draft);
  if (context.fleet) {
    const resolved = resolveFleetRefs(draft, context.fleet);
    if (!resolved.ok) {
      for (const { field, kind } of resolved.issues) {
        if (kind === "not-in-fleet" && !issues.some((i) => i.field === field)) issues.push({ field, kind });
      }
    }
  }
  const number = normalizeReceiptNumber(draft.receiptNumber);
  let duplicate: DraftReview["duplicate"] = null;
  if (number !== null && context.existingNumbers.has(number)) duplicate = "database";
  else if (number !== null && context.batchDuplicates.has(number)) duplicate = "batch";

  const tons = parseTons(draft.tons);
  const amount = parseCop(draft.amount);
  const date = draft.date.trim();
  const mismatch =
    tons !== null && amount !== null && isRealIsoDate(date) ? receiptFigures({ date, tons, amount }, context.tariffs).amountMismatch : false;

  return { issues, duplicate, mismatch, blocked: issues.length > 0 || duplicate !== null };
}

export interface ReceiptFilters {
  from: string | null;
  to: string | null;
  coteroKey: string | null;
  status: ReceiptStatus | null;
  plate: string;
  destination: string;
}

export const NO_RECEIPT_FILTERS: ReceiptFilters = { from: null, to: null, coteroKey: null, status: null, plate: "", destination: "" };

export function filterReceipts(rows: readonly ReceiptRow[], filters: ReceiptFilters): ReceiptRow[] {
  const plate = normalizeVehiclePlate(filters.plate);
  return rows.filter((r) => {
    if (filters.from && r.date < filters.from) return false;
    if (filters.to && r.date > filters.to) return false;
    if (filters.coteroKey && r.coteroKey !== filters.coteroKey) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (plate !== "" && !r.vehiclePlate.includes(plate) && !(r.trailerPlate ?? "").includes(plate)) return false;
    if (filters.destination.trim() !== "" && !matchesQuery([r.destination], filters.destination)) return false;
    return true;
  });
}

export function totalsOfReceipts(rows: readonly ReceiptRow[]): { count: number; tons: number; amount: number } {
  const tons = rows.reduce((sum, r) => sum + r.tons, 0);
  return {
    count: rows.length,
    // Tons carry three decimals: summing floats must not leave a tail.
    tons: Math.round(tons * 1000) / 1000,
    amount: rows.reduce((sum, r) => sum + r.amount, 0),
  };
}
