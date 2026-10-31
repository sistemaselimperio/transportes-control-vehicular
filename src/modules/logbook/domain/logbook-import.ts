/**
 * Pure parsing and planning of a vehicle's logbook Excel ("BITACORA <placa>.xlsx"):
 * workbook rows in, records to create out. Nothing here touches the database; the
 * sheets come from the xlsx reader as plain rows, and the records that already
 * exist come in as data, so every rule is unit-testable.
 */
import {
  cellText,
  isPlateLike,
  parseDateCell,
  parseKmCell,
  stripAccents,
  type CellValue,
} from "@/modules/import-export/domain/cell-parsers";
import type { RawRow, RawSheet } from "@/modules/import-export/domain/types";
import { formatDisplayDate, todayInBogota, type IsoDate } from "@/modules/shared/domain/dates";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import {
  assertModelYear,
  EMPTY_TECHNICAL_DATA,
  type VehicleTechnicalData,
} from "@/modules/vehicles/domain/technical-data";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";

/* ---------------------------------- The file ---------------------------------- */

/** Server actions take at most 4.5 MB of body (next.config.ts); this leaves room for the form overhead. */
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

/** Why the chosen file cannot be read (Spanish copy), or null when it can. */
export function importFileProblem(file: { name: string; size: number }): string | null {
  if (!/\.xlsx$/i.test(file.name)) return "El archivo debe ser un Excel (.xlsx).";
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_IMPORT_BYTES) return "El archivo es demasiado grande (máximo 4 MB).";
  return null;
}

/* ------------------------------- Parsed rows ------------------------------- */

/** A row that cannot be imported, with the reason shown to the operator. */
export interface ImportIssue {
  /** "servicios" for the "MANTENIMIENTO" sheet, "datos" for the "DATOS GENERALES" sheet. */
  tab: "servicios" | "datos";
  /** Row number in the Excel sheet. */
  row: number;
  message: string;
}

export interface ImportedService {
  row: number;
  date: IsoDate;
  description: string;
  provider: string | null;
  km: number | null;
  price: number | null;
  notes: string | null;
}

export interface LogbookImport {
  /** Every distinct plate found in a "PLACA" cell of the file, canonical ("ABC-123"). */
  plates: string[];
  services: ImportedService[];
  /** Technical data found in "DATOS GENERALES": only the fields the sheet has a usable value for. */
  technical: Partial<VehicleTechnicalData>;
  issues: ImportIssue[];
}

/* -------------------------------- Cell helpers -------------------------------- */

const MAX_MONEY = 2_000_000_000;

/** Upper case, no accents, collapsed spaces: how names and labels are compared. */
const norm = (v: CellValue | undefined): string => stripAccents(cellText(v ?? null)).toUpperCase();

/** A label cell without its colon: "PLACA:" and "Placa " both read "PLACA". */
const label = (v: CellValue | undefined): string => norm(v).replace(/:$/, "").trim();

const textOrNull = (v: CellValue | undefined): string | null => cellText(v ?? null) || null;

type Parsed<T> = { value: T; error: null } | { value: null; error: string };

/** Whole pesos from a number or a "1.423.000"-style text; empty is "no value". */
function parseMoney(v: CellValue | undefined, name: string): Parsed<number | null> {
  const text = cellText(v ?? null);
  if (text === "") return { value: null, error: null };
  let amount: number;
  if (typeof v === "number") {
    amount = v;
  } else if (/^\$?[\d.,\s]+$/.test(text)) {
    amount = Number(text.replace(/[^\d]/g, ""));
  } else {
    return { value: null, error: `${name} no válido: "${text}".` };
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY) {
    return { value: null, error: `${name} no válido: "${text}".` };
  }
  return { value: Math.round(amount), error: null };
}

/** Excel day serials of 2000-01-01 and 2100-12-31; day 0 is 1899-12-30. */
const SERIAL_MIN = 36526;
const SERIAL_MAX = 73415;

/** Year of a date text: two digits are 20yy; anything that is not a plausible year is a typo (null). */
function textYear(digits: string): number | null {
  const year = digits.length === 2 ? 2000 + Number(digits) : digits.length === 4 ? Number(digits) : NaN;
  return year >= 2000 && year <= 2100 ? year : null;
}

/**
 * A logbook date however it was typed: a date cell, an Excel day serial, or a text
 * "d/m/yyyy", "d-m-yy", "d.m.yyyy", "yyyy-m-d" (repeated separators and spaces are fine).
 * A year with a typo ("05-08-205") takes `fallbackYear`, the year of the row above:
 * the logbooks are kept in order.
 */
function parseLogDate(v: CellValue | undefined, fallbackYear: number | null): Parsed<IsoDate | null> {
  if (typeof v === "number" && Number.isInteger(v) && v >= SERIAL_MIN && v <= SERIAL_MAX) {
    v = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
  }
  if (typeof v !== "string") {
    const parsed = parseDateCell(v ?? null, "Fecha");
    return parsed.issues.length > 0 ? { value: null, error: parsed.issues[0].message } : { value: parsed.value, error: null };
  }
  const text = cellText(v);
  if (text === "") return { value: null, error: null };
  const parts = /^(\d{1,4})\s*[-/.]+\s*(\d{1,2})\s*[-/.]+\s*(\d{1,4})$/.exec(text);
  if (!parts) return { value: null, error: `Fecha no válida: "${text}".` };
  const [day, month, yearDigits] = parts[1].length === 4 ? [parts[3], parts[2], parts[1]] : [parts[1], parts[2], parts[3]];
  const year = textYear(yearDigits) ?? fallbackYear;
  if (year === null) return { value: null, error: `Fecha no válida: "${text}".` };
  const parsed = parseDateCell(`${Number(day)}/${Number(month)}/${year}`, "Fecha");
  return parsed.value === null ? { value: null, error: `Fecha inexistente: "${text}".` } : { value: parsed.value, error: null };
}

const yearOf = (date: IsoDate): number => Number(date.slice(0, 4));

/** A header row as (label, column) pairs, left to right. */
type Header = Array<[label: string, column: string]>;

const readHeader = (cells: Record<string, CellValue>): Header =>
  Object.keys(cells)
    .sort((a, b) => columnIndex(a) - columnIndex(b))
    .map((column): [string, string] => [label(cells[column]), column]);

/** Column of the first header starting with one of `names`, or `fallback` (the classic layout). */
const columnOf = (header: Header, names: readonly string[], fallback?: string): string | undefined =>
  header.find(([text]) => names.some((n) => text.startsWith(n)))?.[1] ?? fallback;

const DESCRIPTION = ["DESCRIPCION", "DETALLE"];
const PROVIDER = ["PROVEEDOR", "ESTACION"];
const KM = ["KILOMETRAJE", "KM"];
const PRICE = ["PRECIO", "VALOR", "COSTO"];
const NOTES = ["NOVEDAD", "OBSERVACION", "NOTA"];

/** Joins the non-empty parts, without repeats, with "; "; null when nothing is left. */
function joinNotes(parts: ReadonlyArray<string | null>): string | null {
  const kept = [...new Set(parts.filter((p): p is string => !!p))];
  return kept.length > 0 ? kept.join("; ") : null;
}

/** The sheet whose name matches `name` ignoring case, accents and surrounding spaces. */
const findSheet = (sheets: readonly RawSheet[], name: string): RawSheet | undefined =>
  sheets.find((s) => norm(s.name) === name);

const columnIndex = (column: string): number =>
  [...column].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

const sortedRows = (sheet: RawSheet): RawRow[] => [...sheet.rows].sort((a, b) => a.rowNumber - b.rowNumber);

/* ---------------------------------- Plates ---------------------------------- */

/** Plates written to the right of any "PLACA" label, in every sheet. */
function collectPlates(sheets: readonly RawSheet[]): string[] {
  const found = new Set<string>();
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      const columns = Object.keys(row.cells).sort((a, b) => columnIndex(a) - columnIndex(b));
      const at = columns.findIndex((c) => label(row.cells[c]) === "PLACA");
      if (at < 0) continue;
      for (const column of columns.slice(at + 1)) {
        const value = row.cells[column];
        if (isPlateLike(value)) found.add(normalizePlate(cellText(value)));
      }
    }
  }
  return [...found];
}

const plateKey = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Why the file does not belong to `selected` (Spanish copy), or null when it does. */
export function findPlateMismatch(found: readonly string[], selected: string): string | null {
  if (found.length === 0) {
    return "No se encontró la placa en el archivo. Revisa que sea la bitácora del vehículo.";
  }
  const other = found.find((plate) => plateKey(plate) !== plateKey(selected));
  if (other) return `El archivo es de la placa ${other}, pero elegiste el vehículo ${selected}. No se importó nada.`;
  return null;
}

/* ----------------------------- DATOS GENERALES ----------------------------- */

type TechnicalKey = keyof VehicleTechnicalData;

/** Sheet label (normalized) to the technical field it fills; every other label is ignored. */
const TECHNICAL_LABELS: Record<string, TechnicalKey> = {
  "FECHA DE MATRICULA": "registrationDate",
  MODELO: "modelYear",
  "NUMERO DE MOTOR": "engineNumber",
  "NUMERO DE CHASIS": "chassisNumber",
  "NUMERO DE SERIE": "serialNumber",
  "TIPO CARROCERIA": "bodyType",
  "TIPO DE CARROCERIA": "bodyType",
  COMBUSTIBLE: "fuelType",
  CAPACIDAD: "capacity",
  CILINDRAJE: "engineDisplacement",
  PESO: "grossWeightKg",
  "PESO BRUTO": "grossWeightKg",
  COLOR: "color",
};

/** Text of a cell; a number is written without decimals ("80392200", not "80392200.0"). */
const identifierText = (v: CellValue | undefined): string | null =>
  typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : textOrNull(v);

function parseTechnicalValue(key: TechnicalKey, v: CellValue, today: IsoDate): Parsed<string | number | null> {
  switch (key) {
    case "registrationDate":
      return parseLogDate(v, null);
    case "modelYear": {
      const text = cellText(v);
      if (text === "") return { value: null, error: null };
      const year = typeof v === "number" ? v : /^\d{4}$/.test(text) ? Number(text) : NaN;
      if (!Number.isInteger(year)) return { value: null, error: `Modelo no válido: "${text}".` };
      try {
        assertModelYear(year, today);
      } catch (e) {
        if (e instanceof RuleError) return { value: null, error: e.message };
        throw e;
      }
      return { value: year, error: null };
    }
    case "engineDisplacement":
    case "grossWeightKg": {
      const parsed = parseMoney(v, key === "grossWeightKg" ? "Peso" : "Cilindraje");
      return parsed.value === 0 ? { value: null, error: null } : parsed;
    }
    default:
      return { value: identifierText(v), error: null };
  }
}

/** Technical data of the "DATOS GENERALES" sheet: a label in column B, its value in column C. */
function parseTechnicalData(sheet: RawSheet, issues: ImportIssue[], today: IsoDate): Partial<VehicleTechnicalData> {
  const found: Record<string, string | number> = {};
  for (const { rowNumber, cells } of sortedRows(sheet)) {
    const key = TECHNICAL_LABELS[label(cells.B)];
    if (!key || key in found || cells.C == null) continue;
    const parsed = parseTechnicalValue(key, cells.C, today);
    if (parsed.error) issues.push({ tab: "datos", row: rowNumber, message: parsed.error });
    else if (parsed.value !== null) found[key] = parsed.value;
  }
  return found as Partial<VehicleTechnicalData>;
}

/* ------------------------------ MANTENIMIENTO ------------------------------ */

function parseServices(sheet: RawSheet, issues: ImportIssue[]): ImportedService[] {
  const out: ImportedService[] = [];
  const fail = (row: number, message: string) => issues.push({ tab: "servicios", row, message });
  let header: Header | null = null;
  let lastYear: number | null = null;

  for (const { rowNumber, cells } of sortedRows(sheet)) {
    if (label(cells.B) === "FECHA") {
      header = readHeader(cells); // the header (and any repetition of it)
      continue;
    }
    if (!header || label(cells.B).startsWith("MES") || norm(cells.C).startsWith("TOTAL")) continue;
    const columns = {
      description: columnOf(header, DESCRIPTION, "C")!,
      provider: columnOf(header, PROVIDER, "E"),
      km: columnOf(header, KM),
      price: columnOf(header, PRICE, "F"),
      notes: columnOf(header, NOTES, "G"),
    };

    const description = cellText(cells[columns.description] ?? null);
    if (cells.B == null && description === "") continue; // a total or a stray number

    const date = parseLogDate(cells.B, lastYear);
    if (date.error) {
      fail(rowNumber, date.error);
      continue;
    }
    if (date.value === null) {
      fail(rowNumber, "Sin fecha.");
      continue;
    }
    lastYear = yearOf(date.value);
    if (description === "") {
      fail(rowNumber, "Sin descripción.");
      continue;
    }
    const price = parseMoney(columns.price ? cells[columns.price] : undefined, "Precio");
    if (price.error) {
      fail(rowNumber, price.error);
      continue;
    }
    // A km cell holding text (e.g. which trailer it was) is not lost: it goes to the notes.
    const kmCell = columns.km ? cells[columns.km] : undefined;
    const km = parseKmCell(kmCell ?? null).km;
    out.push({
      row: rowNumber,
      date: date.value,
      description,
      provider: columns.provider ? textOrNull(cells[columns.provider]) : null,
      km,
      price: price.value,
      notes: joinNotes([
        columns.notes ? textOrNull(cells[columns.notes]) : null,
        km === null ? textOrNull(kmCell) : null,
      ]),
    });
  }
  return out;
}

/* -------------------------------- Entry point -------------------------------- */

/**
 * Reads the services of "MANTENIMIENTO" and the technical data of "DATOS GENERALES";
 * every other sheet (ACEITE, LLANTAS, COMBUSTIBLE...) is ignored and only feeds the plate check. `ctx.today` bounds the model year.
 */
export function parseLogbookWorkbook(
  sheets: readonly RawSheet[],
  ctx: { today: IsoDate } = { today: todayInBogota() },
): LogbookImport {
  const issues: ImportIssue[] = [];
  const services = findSheet(sheets, "MANTENIMIENTO");
  const general = findSheet(sheets, "DATOS GENERALES");
  const technical = general ? parseTechnicalData(general, issues, ctx.today) : {};
  return {
    plates: collectPlates(sheets),
    services: services ? parseServices(services, issues) : [],
    technical,
    issues,
  };
}

/* ---------------------------------- Planning ---------------------------------- */

/** Technical fields in display order, one label per field (the vehicle file may group some in one row). */
const TECHNICAL_FIELDS: ReadonlyArray<{ key: TechnicalKey; label: string }> = [
  { key: "registrationDate", label: "Fecha de matrícula" },
  { key: "modelYear", label: "Modelo" },
  { key: "engineNumber", label: "Número de motor" },
  { key: "chassisNumber", label: "Número de chasis" },
  { key: "serialNumber", label: "Número de serie" },
  { key: "bodyType", label: "Tipo de carrocería" },
  { key: "fuelType", label: "Combustible" },
  { key: "capacity", label: "Capacidad" },
  { key: "engineDisplacement", label: "Cilindraje" },
  { key: "grossWeightKg", label: "Peso bruto vehicular" },
  { key: "color", label: "Color" },
];

/** What the vehicle already has, just enough to recognize a row that was imported before. */
export interface ExistingRecords {
  services: Array<{ date: IsoDate; description: string; price: number | null }>;
  /** The vehicle's technical data now; absent means every field is empty. */
  technical?: VehicleTechnicalData;
}

export interface ServiceCounts {
  create: number;
  duplicates: number;
  skipped: number;
}

export interface ImportPlan {
  services: ImportedService[];
  /** Technical fields to fill: only those the vehicle has empty. */
  technical: Partial<VehicleTechnicalData>;
  counts: ServiceCounts;
  /** Every row left out for a reason other than being a duplicate, by tab and row. */
  skipped: ImportIssue[];
}

const textKey = (text: string) => stripAccents(text).toUpperCase().replace(/\s+/g, " ").trim();

const serviceKey = (r: { date: string; description: string; price: number | null }) =>
  `${r.date}|${textKey(r.description)}|${r.price ?? ""}`;

/**
 * Decides what to create: rows dated after `today` and rows that already exist, or
 * repeat inside the file, are left out. Planning the same file twice therefore
 * creates nothing the second time.
 */
export function planLogbookImport(
  parsed: LogbookImport,
  existing: ExistingRecords,
  ctx: { today: IsoDate },
): ImportPlan {
  const skipped: ImportIssue[] = [...parsed.issues];
  const counts: ServiceCounts = { create: 0, duplicates: 0, skipped: 0 };

  // Keeps the rows that are neither future nor already known.
  const seen = new Set(existing.services.map(serviceKey));
  const services: ImportedService[] = [];
  for (const row of parsed.services) {
    if (row.date > ctx.today) {
      skipped.push({ tab: "servicios", row: row.row, message: `Fecha futura (${formatDisplayDate(row.date)}).` });
    } else if (seen.has(serviceKey(row))) {
      counts.duplicates += 1;
    } else {
      seen.add(serviceKey(row));
      services.push(row);
    }
  }
  counts.create = services.length;
  // Fill only what the vehicle has empty: an existing value is never overwritten.
  const current = existing.technical ?? EMPTY_TECHNICAL_DATA;
  const technical: Partial<VehicleTechnicalData> = {};
  for (const { key } of TECHNICAL_FIELDS) {
    const value = parsed.technical[key];
    if (value != null && current[key] == null) Object.assign(technical, { [key]: value });
  }

  // General-data issues come last, after the services.
  const order = (tab: ImportIssue["tab"]) => (tab === "datos" ? 1 : 0);
  skipped.sort((a, b) => order(a.tab) - order(b.tab) || a.row - b.row);
  counts.skipped = skipped.filter((s) => s.tab === "servicios").length;

  return { services, technical, counts, skipped };
}

/* ---------------------------------- Preview ---------------------------------- */

/** Skipped rows listed in a preview; the counts always cover all of them. */
export const PREVIEW_SKIPPED_LIMIT = 100;

/** What the operator sees before confirming; plain data, safe to send to the browser. */
export interface ImportPreview {
  plate: string;
  /** "Mantenimiento": what would be created, what already exists and the rows left out. */
  services: ServiceCounts;
  skipped: ImportIssue[];
  /** "Datos generales": the fields that would be filled, and the rows of that sheet left out. */
  technical: { count: number; labels: string[]; skipped: number };
  total: number;
}

export function previewOf(plan: ImportPlan, plate: string): ImportPreview {
  const labels = TECHNICAL_FIELDS.filter(({ key }) => plan.technical[key] != null).map((f) => f.label);
  return {
    plate,
    services: plan.counts,
    skipped: plan.skipped.slice(0, PREVIEW_SKIPPED_LIMIT),
    technical: { count: labels.length, labels, skipped: plan.skipped.filter((s) => s.tab === "datos").length },
    total: plan.counts.create + labels.length,
  };
}
