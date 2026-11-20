/**
 * Rules of the one-off client import (CSV with the columns `name,nit,notes`): parsing, what each
 * row becomes and which rows are skipped. Pure; the script around it owns the file and the database.
 */
import { normalizeNit } from "@/modules/petty-cash/domain/nit";
import { collapseWhitespace, searchKey } from "@/modules/shared/domain/search-key";

/** CSV text as rows of fields: quoted fields may hold commas, line breaks and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** The two notes that name their fincas; matched ignoring case, accents and punctuation. */
const NAMED_LOCATIONS: ReadonlyArray<{ key: string; names: readonly string[] }> = [
  { key: searchKey("2 fincas, portada y zipaquira"), names: ["Portada", "Zipaquirá"] },
  { key: searchKey("2 fincas san migue y caldas"), names: ["San Miguel", "Caldas"] },
];

const COUNTED_LOCATIONS = /^(\d+)\s*fincas/i;

/** Fincas a client starts with, from its note: the named ones, "N fincas" as Finca 1..N, else one "Principal". */
export function locationNamesFromNote(note: string | null): string[] {
  const text = note?.trim() ?? "";
  const key = searchKey(text);
  const named = NAMED_LOCATIONS.find((n) => n.key === key);
  if (named) return [...named.names];
  const count = Number(COUNTED_LOCATIONS.exec(text)?.[1] ?? 0);
  if (count < 1) return ["Principal"];
  return Array.from({ length: count }, (_, i) => `Finca ${i + 1}`);
}

export interface ClientImportRow {
  /** Spaces collapsed, casing as in the file. */
  name: string;
  nameKey: string;
  /** Digits only; null when blank. */
  nit: string | null;
  /** The note as written; null when blank. */
  notes: string | null;
  /** Fincas to create for the client, all without address or map link. */
  locationNames: string[];
}

const TOTAL_ROW = "total";

/** The clients of the CSV, without the rows that have no name and the `TOTAL` row. */
export function parseClientImportCsv(text: string): ClientImportRow[] {
  const [header, ...records] = parseCsv(text);
  const column = (name: string) => (header ?? []).findIndex((h) => h.trim().toLowerCase() === name);
  const [nameAt, nitAt, notesAt] = [column("name"), column("nit"), column("notes")];
  if (nameAt === -1) throw new Error('The CSV needs a header row with a "name" column (name,nit,notes).');

  const rows: ClientImportRow[] = [];
  for (const record of records) {
    const name = collapseWhitespace(record[nameAt] ?? "");
    if (name === "" || name.toLowerCase() === TOTAL_ROW) continue;
    const nit = normalizeNit(nitAt === -1 ? "" : (record[nitAt] ?? ""));
    const notes = (notesAt === -1 ? "" : (record[notesAt] ?? "")).trim();
    rows.push({
      name,
      nameKey: searchKey(name),
      nit: nit === "" ? null : nit,
      notes: notes === "" ? null : notes,
      locationNames: locationNamesFromNote(notes === "" ? null : notes),
    });
  }
  return rows;
}

export type SkipReason =
  | "invalid-name"
  | "existing-nit"
  | "existing-name"
  | "duplicate-nit-in-file"
  | "duplicate-name-in-file";

export interface ClientImportPlan {
  toInsert: ClientImportRow[];
  skipped: Array<{ name: string; reason: SkipReason }>;
  /** Fincas the clients to insert will get. */
  locationCount: number;
}

/**
 * Splits the rows into those to insert and those to skip: a row is skipped when its NIT (if any) or
 * its name key is already in the database, or showed up earlier in the file.
 */
export function planClientImport(
  rows: readonly ClientImportRow[],
  existing: { nits: ReadonlySet<string>; nameKeys: ReadonlySet<string> },
): ClientImportPlan {
  const seenNits = new Set<string>();
  const seenNameKeys = new Set<string>();
  const plan: ClientImportPlan = { toInsert: [], skipped: [], locationCount: 0 };

  for (const row of rows) {
    const reason = skipReason(row, existing, seenNits, seenNameKeys);
    if (row.nit !== null) seenNits.add(row.nit);
    if (row.nameKey !== "") seenNameKeys.add(row.nameKey);
    if (reason) {
      plan.skipped.push({ name: row.name, reason });
    } else {
      plan.toInsert.push(row);
      plan.locationCount += row.locationNames.length;
    }
  }
  return plan;
}

function skipReason(
  row: ClientImportRow,
  existing: { nits: ReadonlySet<string>; nameKeys: ReadonlySet<string> },
  seenNits: ReadonlySet<string>,
  seenNameKeys: ReadonlySet<string>,
): SkipReason | null {
  if (row.nameKey === "") return "invalid-name";
  if (row.nit !== null && existing.nits.has(row.nit)) return "existing-nit";
  if (existing.nameKeys.has(row.nameKey)) return "existing-name";
  if (row.nit !== null && seenNits.has(row.nit)) return "duplicate-nit-in-file";
  if (seenNameKeys.has(row.nameKey)) return "duplicate-name-in-file";
  return null;
}
