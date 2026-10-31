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
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { LOGBOOK_TABS, type LogbookTab } from "./logbook";

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
  tab: LogbookTab;
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

export interface ImportedOil {
  row: number;
  date: IsoDate;
  km: number | null;
  items: OilItem[];
  notes: string | null;
}

export interface ImportedTire {
  row: number;
  date: IsoDate;
  quantity: number;
  reference: string;
  price: number | null;
  notes: string | null;
}

export interface ImportedFuel {
  row: number;
  date: IsoDate;
  gallons: number;
  amount: number;
  provider: string | null;
}

export interface LogbookImport {
  /** Every distinct plate found in a "PLACA" cell of the file, canonical ("ABC-123"). */
  plates: string[];
  services: ImportedService[];
  oils: ImportedOil[];
  tires: ImportedTire[];
  fuels: ImportedFuel[];
  issues: ImportIssue[];
}

/* -------------------------------- Cell helpers -------------------------------- */

const MAX_MONEY = 2_000_000_000;
const MAX_GALLONS = 9999.99;
const MAX_TIRES = 50;

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

/** Gallons with up to two decimals; a comma works as the decimal separator. */
function parseGallons(v: CellValue | undefined): Parsed<number | null> {
  const text = cellText(v ?? null);
  if (text === "") return { value: null, error: null };
  const amount = typeof v === "number" ? v : /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(",", ".")) : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_GALLONS) {
    return { value: null, error: `Cantidad no válida: "${text}".` };
  }
  return { value: Math.round(amount * 100) / 100, error: null };
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

/* ------------------------------- COMBUSTIBLE ------------------------------- */

function parseFuels(sheet: RawSheet, issues: ImportIssue[]): ImportedFuel[] {
  const out: ImportedFuel[] = [];
  const fail = (row: number, message: string) => issues.push({ tab: "combustible", row, message });
  let header: Header | null = null;
  let lastYear: number | null = null;

  for (const { rowNumber, cells } of sortedRows(sheet)) {
    if (label(cells.B) === "FECHA" && Object.values(cells).some((v) => label(v) === "CANTIDAD")) {
      header = readHeader(cells); // every month repeats the header
      continue;
    }
    if (!header || label(cells.B).startsWith("MES")) continue;
    if (norm(cells.B).startsWith("TOTAL") || norm(cells.C).startsWith("TOTAL")) continue;
    const columns = {
      gallons: columnOf(header, ["CANTIDAD", "GALONES"], "C")!,
      urea: columnOf(header, ["UREA"]),
      amount: columnOf(header, PRICE, "D")!,
      provider: columnOf(header, PROVIDER, "E")!,
    };

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
    const gallons = parseGallons(cells[columns.gallons]);
    if (gallons.error || gallons.value === null) {
      const onlyUrea = !gallons.error && columns.urea !== undefined && cells[columns.urea] != null;
      fail(rowNumber, gallons.error ?? (onlyUrea ? "Solo urea, sin galones de combustible." : "Sin cantidad."));
      continue;
    }
    const amount = parseMoney(cells[columns.amount], "Valor");
    if (amount.error || !amount.value) {
      fail(rowNumber, amount.error ?? "Sin valor.");
      continue;
    }
    out.push({
      row: rowNumber,
      date: date.value,
      gallons: gallons.value,
      amount: amount.value,
      provider: textOrNull(cells[columns.provider]),
    });
  }
  return out;
}

/* ------------------------------ ACEITE / LLANTAS ------------------------------ */

/** A "FECHA ... CANTIDAD/DETALLE" block of the oil and tire sheets. */
interface Block {
  row: number;
  date: CellValue;
  km: CellValue;
  /** The CANTIDAD row: where each column of the items is. */
  header: Header;
  items: RawRow[];
}

/**
 * Splits a sheet into its dated blocks. Whatever comes before the first FECHA row
 * (the template list of filters and tires) belongs to no block. A block's items are
 * every non-empty row under its CANTIDAD header up to the next FECHA, blank rows
 * in between included. The date and the km may be typed in column C or D.
 */
function readBlocks(sheet: RawSheet): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let readingItems = false;

  for (const row of sortedRows(sheet)) {
    const { rowNumber, cells } = row;
    const first = label(cells.B);

    if (first === "FECHA") {
      current = { row: rowNumber, date: cells.C ?? cells.D ?? null, km: null, header: [], items: [] };
      blocks.push(current);
      readingItems = false;
      continue;
    }
    if (!current) continue;

    if (first === "CANTIDAD") {
      current.header = readHeader(cells);
      readingItems = true;
    } else if (readingItems) {
      if (Object.keys(cells).length > 0) current.items.push(row);
    } else if (first === "KILOMETRAJE") {
      current.km = cells.C ?? cells.D ?? null;
    }
  }
  return blocks;
}

/**
 * Block date; null (with an issue when there is something to lose) when it cannot be used.
 * `lastYear` carries the year of the previous block, for dates whose year has a typo.
 */
function blockDate(block: Block, tab: LogbookTab, issues: ImportIssue[], lastYear: { value: number | null }): IsoDate | null {
  const parsed = parseLogDate(block.date, lastYear.value);
  if (parsed.error) {
    issues.push({ tab, row: block.row, message: parsed.error });
    return null;
  }
  if (parsed.value !== null) lastYear.value = yearOf(parsed.value);
  if (parsed.value === null) {
    // Empty template blocks are everywhere in these files: only report the ones that hold data.
    if (block.items.some((i) => Object.keys(i.cells).length > 0)) {
      issues.push({ tab, row: block.row, message: "Bloque sin fecha." });
    }
    return null;
  }
  return parsed.value;
}

/** "48 CUARTOS" -> quantity 48 and the unit text; a plain number is the quantity. */
function parseOilQuantity(v: CellValue | undefined): { quantity: number; unit: string } {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return { quantity: v, unit: "" };
  const match = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(cellText(v ?? null));
  if (!match) return { quantity: 1, unit: cellText(v ?? null) };
  const quantity = Number(match[1].replace(",", "."));
  return { quantity: quantity > 0 ? quantity : 1, unit: match[2] };
}

function parseOils(sheet: RawSheet, issues: ImportIssue[]): ImportedOil[] {
  const out: ImportedOil[] = [];
  const lastYear = { value: null as number | null };
  for (const block of readBlocks(sheet)) {
    const date = blockDate(block, "aceite", issues, lastYear);
    if (date === null) continue;
    const detailColumn = columnOf(block.header, DESCRIPTION, "C")!;
    const notesColumn = columnOf(block.header, NOTES, "D")!;

    const items: OilItem[] = [];
    const observations: Array<string | null> = [];
    for (const { cells } of block.items) {
      // A row with only an observation still counts: it goes to the notes.
      observations.push(textOrNull(cells[notesColumn]));
      const { quantity, unit } = parseOilQuantity(cells.B);
      const detail = [unit, cellText(cells[detailColumn] ?? null)].filter(Boolean).join(" ");
      if (detail !== "") items.push({ quantity, detail });
    }
    out.push({
      row: block.row,
      date,
      km: parseKmCell(block.km).km,
      items,
      notes: joinNotes(observations),
    });
  }
  return out;
}

function parseTires(sheet: RawSheet, issues: ImportIssue[]): ImportedTire[] {
  const out: ImportedTire[] = [];
  const lastYear = { value: null as number | null };
  for (const block of readBlocks(sheet)) {
    const date = blockDate(block, "llantas", issues, lastYear);
    if (date === null) continue;
    const fail = (row: number, message: string) => issues.push({ tab: "llantas", row, message });
    const priceColumn = columnOf(block.header, PRICE);
    const kmColumn = columnOf(block.header, KM);
    // The classic layout has a fourth column with the observation when it is not the price.
    const notesColumn = columnOf(block.header, NOTES, priceColumn === "D" || kmColumn === "D" ? undefined : "D");

    for (const { rowNumber, cells } of block.items) {
      if (cells.B == null && cells.C == null) continue; // a leftover note

      const quantityText = cellText(cells.B ?? null);
      if (quantityText === "") {
        fail(rowNumber, "Sin cantidad.");
        continue;
      }
      const quantity = typeof cells.B === "number" ? Math.round(cells.B) : Number(/^\d+/.exec(quantityText)?.[0] ?? NaN);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TIRES) {
        fail(rowNumber, `Cantidad no válida: "${quantityText}".`);
        continue;
      }
      const reference = cellText(cells.C ?? null);
      if (reference === "") {
        fail(rowNumber, "Sin detalle.");
        continue;
      }
      const price = parseMoney(priceColumn ? cells[priceColumn] : undefined, "Valor");
      if (price.error) {
        fail(rowNumber, price.error);
        continue;
      }
      // Tire changes have no km of their own: it is kept in the notes.
      const km = kmColumn ? parseKmCell(cells[kmColumn] ?? null).km : null;
      out.push({
        row: rowNumber,
        date,
        quantity,
        reference,
        price: price.value,
        notes: joinNotes([notesColumn ? textOrNull(cells[notesColumn]) : null, km === null ? null : `KM ${km}`]),
      });
    }
  }
  return out;
}

/* -------------------------------- Entry point -------------------------------- */

/** Reads every logbook sheet of the workbook; unknown sheets (e.g. DATOS GENERALES) only feed the plate check. */
export function parseLogbookWorkbook(sheets: readonly RawSheet[]): LogbookImport {
  const issues: ImportIssue[] = [];
  const services = findSheet(sheets, "MANTENIMIENTO");
  const oils = findSheet(sheets, "ACEITE");
  const tires = findSheet(sheets, "LLANTAS");
  const fuels = findSheet(sheets, "COMBUSTIBLE");
  return {
    plates: collectPlates(sheets),
    services: services ? parseServices(services, issues) : [],
    oils: oils ? parseOils(oils, issues) : [],
    tires: tires ? parseTires(tires, issues) : [],
    fuels: fuels ? parseFuels(fuels, issues) : [],
    issues,
  };
}

/* ---------------------------------- Planning ---------------------------------- */

/** What the vehicle already has, just enough to recognize a row that was imported before. */
export interface ExistingRecords {
  services: Array<{ date: IsoDate; description: string; price: number | null }>;
  fuels: Array<{ date: IsoDate; gallons: number; amount: number }>;
  tires: Array<{ date: IsoDate; reference: string; quantity: number }>;
  oilDates: IsoDate[];
}

export interface TabCounts {
  create: number;
  duplicates: number;
  skipped: number;
}

export interface ImportPlan {
  services: ImportedService[];
  /** Oldest first, the order they are registered in. */
  oils: ImportedOil[];
  tires: ImportedTire[];
  fuels: ImportedFuel[];
  counts: Record<LogbookTab, TabCounts>;
  /** Every row left out for a reason other than being a duplicate, by tab and row. */
  skipped: ImportIssue[];
}

const textKey = (text: string) => stripAccents(text).toUpperCase().replace(/\s+/g, " ").trim();

const serviceKey = (r: { date: string; description: string; price: number | null }) =>
  `${r.date}|${textKey(r.description)}|${r.price ?? ""}`;
const fuelKey = (r: { date: string; gallons: number; amount: number }) =>
  `${r.date}|${r.amount}|${r.gallons.toFixed(2)}`;
const tireKey = (r: { date: string; reference: string; quantity: number }) =>
  `${r.date}|${textKey(r.reference)}|${r.quantity}`;

/**
 * Decides what to create: rows dated after `today` and rows that already exist, or
 * repeat inside the file, are left out. Oil changes come in as the Excel has them,
 * with or without km. Planning the same file twice therefore creates nothing the second time.
 */
export function planLogbookImport(
  parsed: LogbookImport,
  existing: ExistingRecords,
  ctx: { today: IsoDate },
): ImportPlan {
  const skipped: ImportIssue[] = [...parsed.issues];
  const counts = Object.fromEntries(
    LOGBOOK_TABS.map((t) => [t.key, { create: 0, duplicates: 0, skipped: 0 }]),
  ) as Record<LogbookTab, TabCounts>;

  /** Keeps the rows that are neither future nor already known. */
  function select<T extends { row: number; date: IsoDate }>(
    tab: LogbookTab,
    rows: readonly T[],
    known: Iterable<string>,
    key: (row: T) => string,
  ): T[] {
    const seen = new Set(known);
    const kept: T[] = [];
    for (const row of rows) {
      if (row.date > ctx.today) {
        skipped.push({ tab, row: row.row, message: `Fecha futura (${formatDisplayDate(row.date)}).` });
      } else if (seen.has(key(row))) {
        counts[tab].duplicates += 1;
      } else {
        seen.add(key(row));
        kept.push(row);
      }
    }
    return kept;
  }

  const services = select("servicios", parsed.services, existing.services.map(serviceKey), serviceKey);
  const oils = select("aceite", parsed.oils, existing.oilDates, (o) => o.date).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row,
  );
  const tires = select("llantas", parsed.tires, existing.tires.map(tireKey), tireKey);
  const fuels = select("combustible", parsed.fuels, existing.fuels.map(fuelKey), fuelKey);

  counts.servicios.create = services.length;
  counts.aceite.create = oils.length;
  counts.llantas.create = tires.length;
  counts.combustible.create = fuels.length;

  const order = (tab: LogbookTab) => LOGBOOK_TABS.findIndex((t) => t.key === tab);
  skipped.sort((a, b) => order(a.tab) - order(b.tab) || a.row - b.row);
  for (const { tab } of skipped) counts[tab].skipped += 1;

  return { services, oils, tires, fuels, counts, skipped };
}

/* ---------------------------------- Preview ---------------------------------- */

/** Skipped rows listed in a preview; the counts always cover all of them. */
export const PREVIEW_SKIPPED_LIMIT = 100;

/** What the operator sees before confirming; plain data, safe to send to the browser. */
export interface ImportPreview {
  plate: string;
  tabs: Array<{ tab: LogbookTab; label: string } & TabCounts>;
  skipped: ImportIssue[];
  total: number;
}

export function previewOf(plan: ImportPlan, plate: string): ImportPreview {
  const tabs = LOGBOOK_TABS.map(({ key, label: name }) => ({ tab: key, label: name, ...plan.counts[key] }));
  return {
    plate,
    tabs,
    skipped: plan.skipped.slice(0, PREVIEW_SKIPPED_LIMIT),
    total: tabs.reduce((sum, t) => sum + t.create, 0),
  };
}
