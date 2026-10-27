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
  let inTable = false;

  for (const { rowNumber, cells } of sortedRows(sheet)) {
    if (label(cells.B) === "FECHA") {
      inTable = true; // the header (and any repetition of it)
      continue;
    }
    if (!inTable || label(cells.B).startsWith("MES") || norm(cells.C).startsWith("TOTAL")) continue;

    const description = cellText(cells.C ?? null);
    if (cells.B == null && description === "") continue; // a total or a stray number

    const date = parseDateCell(cells.B ?? null, "Fecha");
    if (date.issues.length > 0) {
      fail(rowNumber, date.issues[0].message);
      continue;
    }
    if (date.value === null) {
      fail(rowNumber, "Sin fecha.");
      continue;
    }
    if (description === "") {
      fail(rowNumber, "Sin descripción.");
      continue;
    }
    const price = parseMoney(cells.F, "Precio");
    if (price.error) {
      fail(rowNumber, price.error);
      continue;
    }
    out.push({
      row: rowNumber,
      date: date.value,
      description,
      provider: textOrNull(cells.E),
      price: price.value,
      notes: textOrNull(cells.G),
    });
  }
  return out;
}

/* ------------------------------- COMBUSTIBLE ------------------------------- */

function parseFuels(sheet: RawSheet, issues: ImportIssue[]): ImportedFuel[] {
  const out: ImportedFuel[] = [];
  const fail = (row: number, message: string) => issues.push({ tab: "combustible", row, message });
  let inTable = false;

  for (const { rowNumber, cells } of sortedRows(sheet)) {
    if (label(cells.B) === "FECHA" && label(cells.C) === "CANTIDAD") {
      inTable = true; // every month repeats the header
      continue;
    }
    if (!inTable || label(cells.B).startsWith("MES")) continue;
    if (norm(cells.B).startsWith("TOTAL") || norm(cells.C).startsWith("TOTAL")) continue;

    const date = parseDateCell(cells.B ?? null, "Fecha");
    if (date.issues.length > 0) {
      fail(rowNumber, date.issues[0].message);
      continue;
    }
    if (date.value === null) {
      fail(rowNumber, "Sin fecha.");
      continue;
    }
    const gallons = parseGallons(cells.C);
    if (gallons.error || gallons.value === null) {
      fail(rowNumber, gallons.error ?? "Sin cantidad.");
      continue;
    }
    const amount = parseMoney(cells.D, "Valor");
    if (amount.error || !amount.value) {
      fail(rowNumber, amount.error ?? "Sin valor.");
      continue;
    }
    out.push({
      row: rowNumber,
      date: date.value,
      gallons: gallons.value,
      amount: amount.value,
      provider: textOrNull(cells.E),
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
  /** Normalized header of the fourth column ("OBSERVACION", "VALOR", ...). */
  extraHeader: string;
  items: RawRow[];
}

/**
 * Splits a sheet into its dated blocks. Whatever comes before the first FECHA row
 * (the template list of filters and tires) belongs to no block. A block's items are
 * the consecutive rows under its CANTIDAD header; a blank row ends them.
 */
function readBlocks(sheet: RawSheet): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let itemsFrom: number | null = null; // row number of the last header/item row while reading items

  for (const row of sortedRows(sheet)) {
    const { rowNumber, cells } = row;
    const first = label(cells.B);

    if (first === "FECHA") {
      current = { row: rowNumber, date: cells.C ?? null, km: null, extraHeader: "", items: [] };
      blocks.push(current);
      itemsFrom = null;
      continue;
    }
    if (!current) continue;

    if (first === "CANTIDAD") {
      current.extraHeader = label(cells.D);
      itemsFrom = rowNumber;
      continue;
    }
    if (itemsFrom !== null && rowNumber === itemsFrom + 1) {
      current.items.push(row);
      itemsFrom = rowNumber;
      continue;
    }
    itemsFrom = null;
    if (first === "KILOMETRAJE") current.km = cells.C ?? null;
  }
  return blocks;
}

/** Block date; null (with an issue when there is something to lose) when it cannot be used. */
function blockDate(block: Block, tab: LogbookTab, issues: ImportIssue[]): IsoDate | null {
  const parsed = parseDateCell(block.date, "Fecha");
  if (parsed.issues.length > 0) {
    issues.push({ tab, row: block.row, message: parsed.issues[0].message });
    return null;
  }
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
  for (const block of readBlocks(sheet)) {
    const date = blockDate(block, "aceite", issues);
    if (date === null) continue;

    const items: OilItem[] = [];
    const observations: string[] = [];
    for (const { cells } of block.items) {
      const { quantity, unit } = parseOilQuantity(cells.B);
      const detail = [unit, cellText(cells.C ?? null)].filter(Boolean).join(" ");
      if (detail === "") continue;
      items.push({ quantity, detail });
      const observation = cellText(cells.D ?? null);
      if (observation && !observations.includes(observation)) observations.push(observation);
    }
    out.push({
      row: block.row,
      date,
      km: parseKmCell(block.km).km,
      items,
      notes: observations.length > 0 ? observations.join("; ") : null,
    });
  }
  return out;
}

function parseTires(sheet: RawSheet, issues: ImportIssue[]): ImportedTire[] {
  const out: ImportedTire[] = [];
  for (const block of readBlocks(sheet)) {
    const date = blockDate(block, "llantas", issues);
    if (date === null) continue;
    const fail = (row: number, message: string) => issues.push({ tab: "llantas", row, message });
    const extraIsPrice = block.extraHeader.startsWith("VALOR");

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
      let price: number | null = null;
      if (extraIsPrice) {
        const parsed = parseMoney(cells.D, "Valor");
        if (parsed.error) {
          fail(rowNumber, parsed.error);
          continue;
        }
        price = parsed.value;
      }
      out.push({
        row: rowNumber,
        date,
        quantity,
        reference,
        price,
        notes: extraIsPrice ? null : textOrNull(cells.D),
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
 * Decides what to create: rows dated after `today`, oil changes the vehicle cannot take
 * (no km while its odometer works) and rows that already exist, or repeat inside the
 * file, are left out. Planning the same file twice therefore creates nothing the second time.
 */
export function planLogbookImport(
  parsed: LogbookImport,
  existing: ExistingRecords,
  ctx: { today: IsoDate; odometerWorking: boolean },
): ImportPlan {
  const skipped: ImportIssue[] = [...parsed.issues];
  const counts = Object.fromEntries(
    LOGBOOK_TABS.map((t) => [t.key, { create: 0, duplicates: 0, skipped: 0 }]),
  ) as Record<LogbookTab, TabCounts>;

  /** Keeps the rows that are neither future nor already known; `reject` adds tab-specific reasons. */
  function select<T extends { row: number; date: IsoDate }>(
    tab: LogbookTab,
    rows: readonly T[],
    known: Iterable<string>,
    key: (row: T) => string,
    reject: (row: T) => string | null = () => null,
  ): T[] {
    const seen = new Set(known);
    const kept: T[] = [];
    for (const row of rows) {
      const reason = row.date > ctx.today ? `Fecha futura (${formatDisplayDate(row.date)}).` : null;
      if (reason) {
        skipped.push({ tab, row: row.row, message: reason });
      } else if (seen.has(key(row))) {
        counts[tab].duplicates += 1;
      } else {
        const rejected = reject(row);
        if (rejected) {
          skipped.push({ tab, row: row.row, message: rejected });
        } else {
          seen.add(key(row));
          kept.push(row);
        }
      }
    }
    return kept;
  }

  const services = select("servicios", parsed.services, existing.services.map(serviceKey), serviceKey);
  const oils = select(
    "aceite",
    parsed.oils,
    existing.oilDates,
    (o) => o.date,
    (o) =>
      ctx.odometerWorking && o.km === null
        ? "Sin kilometraje: el cambio de aceite lo necesita porque el odómetro del vehículo funciona."
        : null,
  ).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row));
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
