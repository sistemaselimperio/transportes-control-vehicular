/**
 * Turns the raw rows of the legacy Excel (T. IMPERIO, F.PAEZ, TRAILER) into
 * parsed vehicles plus issues. Pure: no I/O, no database.
 */
import type { IsoDate } from "@/modules/shared/domain/dates";
import {
  cellText,
  detectStatusWord,
  isPlateLike,
  parseClassCell,
  parseDocumentCell,
  parseDriverCell,
  parseKmCell,
  parseNextChangeCell,
  parseOilDateCell,
  parsePhoneCell,
  parsePlateCell,
  parsePolicyCell,
  parseServiceCell,
  parseTaxCell,
  parseTrailerReference,
  stripAccents,
  type CellValue,
  type Issue,
  type StatusWord,
} from "./cell-parsers";
import type {
  ImportedStatus,
  OwnerRef,
  ParsedDocument,
  ParsedImport,
  ParsedVehicle,
  RawRow,
  RawSheet,
  RejectedRow,
  SheetResult,
} from "./types";

const up = (v: CellValue) => stripAccents(cellText(v)).toUpperCase();
const cell = (row: RawRow, col: string): CellValue => row.cells[col] ?? null;
const isEmpty = (v: CellValue) => v == null || (!(v instanceof Date) && cellText(v) === "");

/* ------------------------------ vehicle builder ------------------------------ */

interface MotorRowInput {
  sheet: string;
  rowNumber: number;
  plate: string;
  owner: OwnerRef;
  today: IsoDate;
  classCell: CellValue;
  /** `undefined` means the layout has no such column. */
  municipality?: CellValue;
  service?: CellValue;
  policy?: CellValue;
  tax?: CellValue;
  driver?: CellValue;
  phone?: CellValue;
  oilDate?: CellValue;
  km?: CellValue;
  next?: CellValue;
  approx?: CellValue;
  soat?: CellValue;
  tecno?: CellValue;
  /** Free columns that may hold a status word or a note. */
  extras?: CellValue[];
  forceSold?: boolean;
  buyer?: string | null;
  extraNotes?: string[];
}

const PLAIN_STATUS = /^(QU?IETA|TALLER)$/;

function documentOrNull(r: {
  expiresOn: IsoDate | null;
  notApplicable: boolean;
}): ParsedDocument | null {
  if (r.expiresOn == null && !r.notApplicable) return null;
  return { kind: null, expiresOn: r.expiresOn, notApplicable: r.notApplicable };
}

function buildMotorVehicle(input: MotorRowInput): ParsedVehicle {
  const issues: Issue[] = [];
  const notes: string[] = [...(input.extraNotes ?? [])];
  const statuses: StatusWord[] = [];
  const currentYear = Number(input.today.slice(0, 4));

  const addStatusFrom = (value: CellValue) => {
    const status = detectStatusWord(value);
    if (!status) return false;
    statuses.push(status);
    const text = cellText(value);
    if (!PLAIN_STATUS.test(up(value))) notes.push(`Estado en Excel: "${text}"`);
    return true;
  };

  const cls = parseClassCell(input.classCell);
  issues.push(...cls.issues);
  if (cls.className == null) {
    issues.push({
      level: "warning",
      field: "Clase",
      message: "Sin clase en el Excel; se asumió Automóvil. Revisar.",
    });
  }

  const policy = parsePolicyCell(input.policy ?? null);
  issues.push(...policy.issues);
  if (policy.note) notes.push(policy.note);

  const tax = parseTaxCell(input.tax ?? null, currentYear);
  issues.push(...tax.issues);

  const km = parseKmCell(input.km ?? null);
  issues.push(...km.issues);

  const oil = parseOilDateCell(input.oilDate ?? null);
  issues.push(...oil.issues);
  if (oil.status) statuses.push(oil.status);

  const next = parseNextChangeCell(input.next ?? null);
  issues.push(...next.issues);
  if (next.status) statuses.push(next.status);

  const approx = parseNextChangeCell(input.approx ?? null, "Aproximada");
  issues.push(...approx.issues);
  if (approx.status) {
    statuses.push(approx.status);
    if (!PLAIN_STATUS.test(up(input.approx ?? null))) {
      notes.push(`Estado en Excel: "${cellText(input.approx ?? null)}"`);
    }
  }

  const driverCell = parseDriverCell(input.driver ?? null);
  if (driverCell.status) statuses.push(driverCell.status);
  if (driverCell.note) notes.push(driverCell.note);

  const phone = parsePhoneCell(input.phone ?? null);
  if (phone.note) notes.push(phone.note);

  const soat = parseDocumentCell(input.soat ?? null, "SOAT");
  issues.push(...soat.issues);
  const tecno = parseDocumentCell(input.tecno ?? null, "Tecnomecánica");
  issues.push(...tecno.issues);

  for (const extra of input.extras ?? []) {
    const text = cellText(extra);
    if (text === "") continue;
    if (!addStatusFrom(extra)) notes.push(`Excel: ${text}`);
  }

  const sold = Boolean(input.forceSold) || policy.sold;
  let status: ImportedStatus = "ACTIVE";
  if (sold) status = "SOLD";
  else if (statuses.includes("IN_WORKSHOP")) status = "IN_WORKSHOP";
  else if (statuses.includes("IDLE")) status = "IDLE";

  const service = parseServiceCell(input.service ?? null);
  if (input.service !== undefined && service == null && !sold) {
    issues.push({
      level: "warning",
      field: "Servicio",
      message: "Servicio vacío; se dejó Particular. Revisar.",
    });
  }

  const nextDate = next.nextDate ?? approx.nextDate;
  let oilChange: ParsedVehicle["oilChange"] = null;
  if (!sold) {
    if (oil.date) {
      oilChange = {
        date: oil.date,
        km: km.km,
        nextKm: next.nextKm,
        nextDate,
      };
    } else if (next.nextKm != null || nextDate != null) {
      issues.push({
        level: "warning",
        field: "F. cambio",
        message:
          "Hay próximo cambio pero no fecha del último cambio; no se creó el registro de cambio.",
      });
      notes.push(
        `Próx. cambio en Excel: ${next.nextKm != null ? `${next.nextKm} km` : nextDate}`,
      );
    }
  }

  let driver: ParsedVehicle["driver"] = null;
  if (!sold) {
    if (driverCell.driverName) {
      driver = { name: driverCell.driverName, phone: phone.phone };
    } else if (phone.phone) {
      notes.push(`Celular sin conductor: ${phone.phone}`);
    }
  }

  const policyDoc: ParsedDocument | null = policy.sold
    ? null
    : policy.expiresOn == null && !policy.notApplicable
      ? null
      : {
          kind: policy.kind,
          expiresOn: policy.expiresOn,
          notApplicable: policy.notApplicable,
        };

  return {
    sheet: input.sheet,
    rowNumber: input.rowNumber,
    plate: input.plate,
    className: cls.className ?? "Automóvil",
    brandLine: cls.brandLine,
    owner: input.owner,
    municipality: cellText(input.municipality ?? null) || null,
    serviceType: service ?? "PARTICULAR",
    status,
    odometerWorking: km.odometerWorking,
    currentKm: km.km,
    currentKmAt: km.km != null ? oil.date : null,
    tax: { kind: tax.kind, year: tax.year },
    policy: policyDoc,
    soat: documentOrNull(soat),
    tecno: documentOrNull(tecno),
    driver,
    oilChange,
    sale: sold ? { buyer: input.buyer ?? null } : null,
    notes,
    issues,
  };
}

/* -------------------------------- sheet helpers -------------------------------- */

/** Some rows have plate and class swapped; the one that looks like a plate wins. */
function resolvePair(
  plateCandidate: CellValue,
  classCandidate: CellValue,
): { plate: CellValue; cls: CellValue; swapped: boolean } {
  if (!isPlateLike(plateCandidate) && isPlateLike(classCandidate)) {
    return { plate: classCandidate, cls: plateCandidate, swapped: true };
  }
  return { plate: plateCandidate, cls: classCandidate, swapped: false };
}

class SheetCollector {
  readonly vehicles: ParsedVehicle[] = [];
  readonly rejected: RejectedRow[] = [];
  constructor(readonly sheet: string) {}

  /** Parses the plate; on failure records the rejected row and returns null. */
  plate(row: RawRow, raw: CellValue): string | null {
    const r = parsePlateCell(raw);
    if (r.plate == null) {
      this.rejected.push({
        sheet: this.sheet,
        rowNumber: row.rowNumber,
        plateText: cellText(raw),
        reason: "invalid_plate",
        issues: r.issues,
      });
    }
    return r.plate;
  }

  result(): SheetResult {
    return { sheet: this.sheet, vehicles: this.vehicles, rejected: this.rejected };
  }
}

const isHeaderRow = (row: RawRow, cols: string[]) =>
  up(cell(row, "B")) === "ITEMS" ||
  cols.some((c) => up(cell(row, c)).startsWith("PLACA"));

/* ------------------------------------ IMPERIO ------------------------------------ */

export function parseImperioSheet(sheet: RawSheet, today: IsoDate): SheetResult {
  const out = new SheetCollector(sheet.name);
  for (const row of sheet.rows) {
    if (isHeaderRow(row, ["D"])) continue;
    const raw = cell(row, "D");
    if (isEmpty(raw)) continue;
    const plate = out.plate(row, raw);
    if (plate == null) continue;

    out.vehicles.push(
      buildMotorVehicle({
        sheet: sheet.name,
        rowNumber: row.rowNumber,
        plate,
        owner: { kind: "IMPERIO" },
        today,
        classCell: cell(row, "C"),
        policy: cell(row, "E"),
        municipality: cell(row, "F"),
        service: cell(row, "G"),
        tax: cell(row, "H"),
        driver: cell(row, "I"),
        phone: cell(row, "J"),
        oilDate: cell(row, "K"),
        km: cell(row, "L"),
        next: cell(row, "M"),
        soat: cell(row, "N"),
        tecno: cell(row, "O"),
        extras: [cell(row, "P")],
      }),
    );
  }
  return out.result();
}

/* ------------------------------------- PAEZ ------------------------------------- */

type RightSection = "listed" | "unknown" | "sold";

function parsePaezMainAndLower(
  sheet: RawSheet,
  today: IsoDate,
  out: { main: SheetCollector; lower: SheetCollector },
) {
  let lowerBlock = false;
  for (const row of sheet.rows) {
    const b = up(cell(row, "B"));
    const c = up(cell(row, "C"));
    if (
      (b.includes("SANDRA MARCELA") || c.includes("SANDRA MARCELA")) &&
      !isPlateLike(cell(row, "D"))
    ) {
      lowerBlock = true;
      continue;
    }
    if (isHeaderRow(row, ["C", "D"])) continue;

    const { plate: plateRaw, cls } = resolvePair(cell(row, "D"), cell(row, "C"));
    if (isEmpty(plateRaw)) continue;

    if (!lowerBlock) {
      const plate = out.main.plate(row, plateRaw);
      if (plate == null) continue;
      out.main.vehicles.push(
        buildMotorVehicle({
          sheet: sheet.name,
          rowNumber: row.rowNumber,
          plate,
          owner: { kind: "FABIAN" },
          today,
          classCell: cls,
          policy: cell(row, "E"),
          municipality: cell(row, "F"),
          service: cell(row, "G"),
          tax: cell(row, "H"),
          driver: cell(row, "I"),
          phone: cell(row, "J"),
          oilDate: cell(row, "K"),
          km: cell(row, "L"),
          next: cell(row, "M"),
          approx: cell(row, "N"),
          soat: cell(row, "O"),
          tecno: cell(row, "P"),
          extras: [cell(row, "Q")],
        }),
      );
      continue;
    }

    // Sandra's block: imported without owner (owners are assigned one by one).
    // Policy renewals live in L; E keeps the previous (older) date.
    const plate = out.lower.plate(row, plateRaw);
    if (plate == null) continue;
    const newPolicy = cell(row, "L");
    const oldPolicy = cell(row, "E");
    const policy = !isEmpty(newPolicy)
      ? newPolicy
      : oldPolicy instanceof Date || typeof oldPolicy === "string"
        ? oldPolicy
        : null;
    out.lower.vehicles.push(
      buildMotorVehicle({
        sheet: sheet.name,
        rowNumber: row.rowNumber,
        plate,
        owner: { kind: "UNKNOWN" },
        today,
        classCell: cls,
        policy,
        tax: cell(row, "H"),
        phone: cell(row, "K"),
        soat: cell(row, "I"),
        tecno: cell(row, "J"),
      }),
    );
  }
}

function parsePaezRightBlock(
  sheet: RawSheet,
  today: IsoDate,
  out: SheetCollector,
) {
  let section: RightSection = "listed";
  for (const row of sheet.rows) {
    const r = up(cell(row, "R"));
    const s = up(cell(row, "S"));
    if (r.includes("NO UBICADO") || s.includes("NO UBICADO")) {
      section = "unknown";
      continue;
    }
    if (r === "VENDIDO" || s === "VENDIDO") {
      section = "sold";
      continue;
    }
    if (r === "ITEMS" || s.startsWith("PLACA")) continue;

    const { plate: plateRaw, cls, swapped } = resolvePair(
      cell(row, "S"),
      cell(row, "T"),
    );
    if (isEmpty(plateRaw) && isEmpty(cls)) continue;
    if (isEmpty(plateRaw)) continue;
    const plate = out.plate(row, plateRaw);
    if (plate == null) continue;

    const sold = section === "sold";
    // In swapped sold rows U holds the buyer and V the municipality.
    const buyer = swapped ? cellText(cell(row, "U")) || null : null;
    out.vehicles.push(
      buildMotorVehicle({
        sheet: sheet.name,
        rowNumber: row.rowNumber,
        plate,
        owner: { kind: "UNKNOWN" },
        today,
        classCell: cls,
        municipality: swapped ? cell(row, "V") : undefined,
        policy: cell(row, "X"),
        tax: cell(row, "Y"),
        phone: cell(row, "W"),
        soat: swapped ? undefined : cell(row, "U"),
        tecno: swapped ? undefined : cell(row, "V"),
        forceSold: sold,
        buyer,
        extraNotes: section === "unknown" ? ["NO UBICADO PROPIETARIO"] : [],
      }),
    );
  }
}

export function parsePaezSheet(sheet: RawSheet, today: IsoDate): SheetResult {
  const main = new SheetCollector(sheet.name);
  const lower = new SheetCollector(sheet.name);
  const right = new SheetCollector(sheet.name);
  parsePaezMainAndLower(sheet, today, { main, lower });
  parsePaezRightBlock(sheet, today, right);
  // Order matters for de-duplication: the updated Sandra block beats the right-hand list.
  return {
    sheet: sheet.name,
    vehicles: [...main.vehicles, ...lower.vehicles, ...right.vehicles],
    rejected: [...main.rejected, ...lower.rejected, ...right.rejected],
  };
}

/* ------------------------------------ TRAILER ------------------------------------ */

function parseTrailerOwner(text: string): {
  owner: OwnerRef;
  sold: boolean;
  buyer: string | null;
  note: string | null;
  issue: Issue | null;
} {
  const upper = stripAccents(text).toUpperCase();
  const base = { owner: { kind: "UNKNOWN" } as OwnerRef, sold: false, buyer: null, note: null, issue: null };
  if (text === "") {
    return {
      ...base,
      issue: { level: "warning", field: "Propietario", message: "Sin propietario en el Excel." },
    };
  }
  if (upper.startsWith("VENDIDO")) {
    const buyer = text.replace(/^VENDIDO(\s+A)?\s*/i, "").trim();
    return { ...base, sold: true, buyer: buyer || null };
  }
  if (upper.startsWith("TRANSPASO")) {
    return { ...base, note: `Propietario: ${text}` };
  }
  if (upper.includes("IMPERIO")) return { ...base, owner: { kind: "IMPERIO" } };
  if (upper.includes("FABIAN")) return { ...base, owner: { kind: "FABIAN" } };
  return { ...base, owner: { kind: "THIRD_PARTY", name: text } };
}

export function parseTrailerSheet(sheet: RawSheet, _today: IsoDate): SheetResult {
  void _today;
  const out = new SheetCollector(sheet.name);
  for (const row of sheet.rows) {
    if (up(cell(row, "C")).startsWith("REFERENCIA")) continue;
    if (isEmpty(cell(row, "C"))) continue;

    const ref = parseTrailerReference(cell(row, "C"));
    const plate = out.plate(row, ref.plateText);
    if (plate == null) continue;

    const issues: Issue[] = [];
    const notes: string[] = [];
    if (ref.note) notes.push(ref.note);

    const owner = parseTrailerOwner(cellText(cell(row, "D")));
    if (owner.issue) issues.push(owner.issue);
    if (owner.note) notes.push(owner.note);

    const obs = cellText(cell(row, "F")) || cellText(cell(row, "E"));
    if (/[\p{L}\d]/u.test(obs)) notes.push(`Observaciones: ${obs}`);

    out.vehicles.push({
      sheet: sheet.name,
      rowNumber: row.rowNumber,
      plate,
      className: "Remolque",
      brandLine: ref.brandLine,
      owner: owner.owner,
      municipality: null,
      serviceType: "PARTICULAR",
      status: owner.sold ? "SOLD" : "ACTIVE",
      odometerWorking: true,
      currentKm: null,
      currentKmAt: null,
      tax: { kind: "EXEMPT", year: null },
      policy: null,
      soat: { kind: null, expiresOn: null, notApplicable: true },
      tecno: { kind: null, expiresOn: null, notApplicable: true },
      driver: null,
      oilChange: null,
      sale: owner.sold ? { buyer: owner.buyer } : null,
      notes,
      issues,
    });
  }
  return out.result();
}

/* ------------------------------------ workbook ------------------------------------ */

export function parseWorkbook(sheets: RawSheet[], today: IsoDate): ParsedImport {
  const results: SheetResult[] = [];
  const ignoredSheets: string[] = [];

  for (const sheet of sheets) {
    const name = up(sheet.name);
    if (name.includes("IMPERIO")) results.push(parseImperioSheet(sheet, today));
    else if (name.includes("PAEZ")) results.push(parsePaezSheet(sheet, today));
    else if (name.includes("TRAILER")) results.push(parseTrailerSheet(sheet, today));
    else ignoredSheets.push(sheet.name);
  }

  // A plate can appear twice (e.g. Sandra's lists): the first parsed row wins.
  const firstSeen = new Map<string, { sheet: string; rowNumber: number }>();
  for (const result of results) {
    const kept: ParsedVehicle[] = [];
    for (const v of result.vehicles) {
      const first = firstSeen.get(v.plate);
      if (!first) {
        firstSeen.set(v.plate, { sheet: v.sheet, rowNumber: v.rowNumber });
        kept.push(v);
        continue;
      }
      result.rejected.push({
        sheet: v.sheet,
        rowNumber: v.rowNumber,
        plateText: v.plate,
        reason: "duplicate",
        issues: [
          {
            level: "warning",
            field: "Placa",
            message: `La placa ya aparece en ${first.sheet} fila ${first.rowNumber}; se usó esa fila.`,
          },
        ],
      });
    }
    result.vehicles = kept;
  }

  return { sheets: results, ignoredSheets };
}
