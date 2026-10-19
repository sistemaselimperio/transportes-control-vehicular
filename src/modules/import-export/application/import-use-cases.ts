import { todayInBogota } from "@/modules/shared/domain/dates";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import type { Issue } from "../domain/cell-parsers";
import { parseWorkbook } from "../domain/parse-sheets";
import type { OwnerRef, ParsedImport, ParsedVehicle } from "../domain/types";
import {
  findExistingPlates,
  importVehicles,
} from "../infrastructure/import-repository";
import { readWorkbook } from "../infrastructure/xlsx-reader";

export type PreviewRowState =
  | "new"
  | "existing"
  | "invalid_plate"
  | "duplicate";

export interface PreviewRow {
  rowNumber: number;
  plate: string;
  className: string | null;
  brandLine: string | null;
  ownerLabel: string;
  status: string | null;
  state: PreviewRowState;
  issues: Issue[];
  notes: string[];
}

export interface SheetPreview {
  sheet: string;
  counts: {
    total: number;
    new: number;
    withWarnings: number;
    withErrors: number;
    existing: number;
    rejected: number;
  };
  rows: PreviewRow[];
}

export interface ImportPreview {
  sheets: SheetPreview[];
  ignoredSheets: string[];
  totals: SheetPreview["counts"];
}

export interface ImportResult {
  created: number;
  skippedExisting: string[];
  rejected: number;
  warnings: number;
  errors: number;
}

export function ownerLabel(ref: OwnerRef): string {
  switch (ref.kind) {
    case "IMPERIO":
    case "FABIAN":
    case "SANDRA":
      return KNOWN_OWNERS[ref.kind].name;
    case "THIRD_PARTY":
      return ref.name;
    case "UNKNOWN":
      return "Sin propietario";
  }
}

const hasLevel = (issues: Issue[], level: Issue["level"]) =>
  issues.some((i) => i.level === level);

function emptyCounts(): SheetPreview["counts"] {
  return { total: 0, new: 0, withWarnings: 0, withErrors: 0, existing: 0, rejected: 0 };
}

async function parseUpload(data: Uint8Array): Promise<ParsedImport> {
  const sheets = await readWorkbook(data);
  return parseWorkbook(sheets, todayInBogota());
}

function allVehicles(parsed: ParsedImport): ParsedVehicle[] {
  return parsed.sheets.flatMap((s) => s.vehicles);
}

/** Parses the workbook and compares it with the database. Writes nothing. */
export async function previewImport(data: Uint8Array): Promise<ImportPreview> {
  const parsed = await parseUpload(data);
  const existing = await findExistingPlates(allVehicles(parsed).map((v) => v.plate));

  const totals = emptyCounts();
  const sheets: SheetPreview[] = parsed.sheets.map((sheet) => {
    const counts = emptyCounts();
    const rows: PreviewRow[] = [];

    for (const v of sheet.vehicles) {
      const isExisting = existing.has(v.plate);
      counts.total++;
      if (isExisting) counts.existing++;
      else {
        counts.new++;
        if (hasLevel(v.issues, "error")) counts.withErrors++;
        else if (hasLevel(v.issues, "warning")) counts.withWarnings++;
      }
      rows.push({
        rowNumber: v.rowNumber,
        plate: v.plate,
        className: v.className,
        brandLine: v.brandLine,
        ownerLabel: ownerLabel(v.owner),
        status: v.status,
        state: isExisting ? "existing" : "new",
        issues: v.issues,
        notes: v.notes,
      });
    }
    for (const r of sheet.rejected) {
      counts.total++;
      counts.rejected++;
      rows.push({
        rowNumber: r.rowNumber,
        plate: r.plateText,
        className: null,
        brandLine: null,
        ownerLabel: "",
        status: null,
        state: r.reason,
        issues: r.issues,
        notes: [],
      });
    }
    rows.sort((a, b) => a.rowNumber - b.rowNumber);

    for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
      totals[key] += counts[key];
    }
    return { sheet: sheet.sheet, counts, rows };
  });

  return { sheets, ignoredSheets: parsed.ignoredSheets, totals };
}

/** Re-parses the file on the server and writes it in one transaction. */
export async function confirmImport(data: Uint8Array): Promise<ImportResult> {
  const parsed = await parseUpload(data);
  const vehicles = allVehicles(parsed);
  const outcome = await importVehicles(vehicles, todayInBogota());

  const createdSet = new Set(outcome.created);
  let warnings = 0;
  let errors = 0;
  for (const v of vehicles) {
    if (!createdSet.has(v.plate)) continue;
    for (const issue of v.issues) {
      if (issue.level === "error") errors++;
      else warnings++;
    }
  }
  return {
    created: outcome.created.length,
    skippedExisting: outcome.skippedExisting,
    rejected: parsed.sheets.reduce((n, s) => n + s.rejected.length, 0),
    warnings,
    errors,
  };
}
