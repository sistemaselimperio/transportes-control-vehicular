/**
 * Reading the accounting software's voucher export (EC1 = Fabián Páez, EGT = Transportes): a sheet
 * with the company on top, a header row (Tipo, Número, Vr. Total, Detalle Obs/Anexo, ...) and one
 * voucher per row, ending in a row that only carries the grand total. Pure: the Excel file is read
 * into a grid of cells elsewhere.
 */

export const COMPANIES = ["EC1", "EGT"] as const;
export type Company = (typeof COMPANIES)[number];

export const COMPANY_LABELS: Record<Company, string> = { EC1: "Fabián Páez", EGT: "Transportes" };

export const isCompany = (value: unknown): value is Company => (COMPANIES as readonly unknown[]).includes(value);

/** Detail stored for a voucher whose detail cell is empty. */
/** Largest value a peso column (int4) can hold. */
export const MAX_VALUE = 2_147_483_647;

export const NO_DETAIL = "Sin detalle";

export type Cell = string | number | Date | boolean | null | undefined;

export interface ParsedVoucher {
  /** 1-based row of the sheet, to point at it in the preview. */
  rowNumber: number;
  company: Company;
  /** Without leading zeros. */
  voucherNumber: string;
  detail: string;
  /** Whole pesos, above zero. */
  value: number;
}

export interface SkippedVoucher {
  rowNumber: number;
  reason: string;
}

export interface ParsedSheet {
  rows: ParsedVoucher[];
  skipped: SkippedVoucher[];
  /** Set when the sheet is not a voucher export; nothing else is read then. */
  error: string | null;
}

const text = (cell: Cell): string => (cell === null || cell === undefined ? "" : cell instanceof Date ? "" : String(cell).trim());

/** "0000005142" -> "5142". Null when the cell is blank. */
export function normalizeVoucherNumber(cell: Cell): string | null {
  const raw = text(cell);
  if (raw === "") return null;
  const stripped = raw.replace(/^0+(?=\d)/, "");
  return stripped;
}

/** The detail without the " /" the software appends and without surrounding spaces. */
export function cleanDetail(cell: Cell): string {
  return text(cell)
    .replace(/(?:\s*\/)+\s*$/, "")
    .trim();
}

/** Whole pesos above zero from a number or a text such as "$ 1.200.000"; null otherwise. */
export function parseVoucherValue(cell: Cell): number | null {
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return null;
    const rounded = Math.round(cell);
    return rounded > 0 && rounded <= MAX_VALUE ? rounded : null;
  }
  const raw = text(cell).replace(/[$\s]/g, "");
  if (!/^\d+([.,]\d{3})*$/.test(raw)) return null;
  const value = Number(raw.replace(/[.,]/g, ""));
  return value > 0 && value <= MAX_VALUE ? value : null;
}

/** Lower case, no accents and only letters and digits: a mis-encoded "N�mero" becomes "nmero". */
function headerKey(cell: Cell): string {
  return text(cell)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

interface Columns {
  type: number;
  number: number;
  value: number;
  detail: number;
}

function findColumns(row: readonly Cell[]): Columns | null {
  const keys = row.map(headerKey);
  const type = keys.findIndex((k) => k === "tipo");
  const number = keys.findIndex((k) => k === "numero" || k === "nmero");
  const value = keys.findIndex((k) => k === "vrtotal");
  const detail = keys.findIndex((k) => k.startsWith("detalle"));
  return type >= 0 && number >= 0 && value >= 0 && detail >= 0 ? { type, number, value, detail } : null;
}

const HEADER_SCAN_ROWS = 30;
const NOT_A_VOUCHER_SHEET = "No se encontraron los encabezados del comprobante (Tipo, Número, Vr. Total, Detalle).";

/** The vouchers of one sheet (a grid of rows of cells), plus the rows that cannot be imported and why. */
export function parseVoucherSheet(grid: ReadonlyArray<ReadonlyArray<Cell>>): ParsedSheet {
  let headerIndex = -1;
  let columns: Columns | null = null;
  for (let i = 0; i < Math.min(grid.length, HEADER_SCAN_ROWS) && columns === null; i++) {
    columns = findColumns(grid[i] ?? []);
    if (columns) headerIndex = i;
  }
  if (!columns) return { rows: [], skipped: [], error: NOT_A_VOUCHER_SHEET };

  const rows: ParsedVoucher[] = [];
  const skipped: SkippedVoucher[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = grid[i] ?? [];
    const rowNumber = i + 1;
    const type = text(cells[columns.type]).toUpperCase();
    const number = normalizeVoucherNumber(cells[columns.number]);
    const detailRaw = text(cells[columns.detail]);
    // Blank rows and the closing total row (only a value) are not vouchers.
    if (type === "" && number === null && detailRaw === "") continue;

    if (!isCompany(type)) {
      skipped.push({ rowNumber, reason: type === "" ? "Falta el tipo del comprobante." : `Tipo ${type} no es EC1 ni EGT.` });
      continue;
    }
    if (number === null) {
      skipped.push({ rowNumber, reason: "Falta el número del comprobante." });
      continue;
    }
    const value = parseVoucherValue(cells[columns.value]);
    if (value === null) {
      skipped.push({ rowNumber, reason: "Falta el valor del comprobante o no es válido." });
      continue;
    }
    rows.push({ rowNumber, company: type, voucherNumber: number, detail: cleanDetail(cells[columns.detail]) || NO_DETAIL, value });
  }
  return { rows, skipped, error: null };
}

/** The identity of a voucher: numbers are unique per company. */
export const voucherKey = (company: Company, voucherNumber: string): string => `${company}:${voucherNumber}`;

export type DuplicateReason = "stored" | "repeated";

export interface Classified<T extends ParsedVoucher = ParsedVoucher> {
  toImport: T[];
  duplicates: Array<{ row: T; reason: DuplicateReason }>;
}

/**
 * Splits the rows into the ones to save and the duplicates: a voucher already stored (in any box) or
 * repeated within the upload is blocked. Of a repeated voucher the first row is kept.
 */
export function classifyImport<T extends ParsedVoucher>(rows: readonly T[], stored: ReadonlySet<string>): Classified<T> {
  const toImport: T[] = [];
  const duplicates: Classified<T>["duplicates"] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = voucherKey(row.company, row.voucherNumber);
    if (stored.has(key)) duplicates.push({ row, reason: "stored" });
    else if (seen.has(key)) duplicates.push({ row, reason: "repeated" });
    else {
      seen.add(key);
      toImport.push(row);
    }
  }
  return { toImport, duplicates };
}
