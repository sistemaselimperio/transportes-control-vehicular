import type { IsoDate } from "@/modules/shared/domain/dates";
import type {
  CellValue,
  ClassName,
  Issue,
  PolicyKind,
  TaxKind,
} from "./cell-parsers";

/** One spreadsheet row; cells are keyed by column letter ("A", "B", ...). */
export interface RawRow {
  rowNumber: number;
  cells: Record<string, CellValue>;
}

export interface RawSheet {
  name: string;
  rows: RawRow[];
}

export type OwnerRef =
  | { kind: "IMPERIO" }
  | { kind: "FABIAN" }
  | { kind: "THIRD_PARTY"; name: string }
  | { kind: "UNKNOWN" };

export type ImportedStatus = "ACTIVE" | "IDLE" | "IN_WORKSHOP" | "SOLD";

export interface ParsedDocument {
  kind: PolicyKind | null;
  expiresOn: IsoDate | null;
  notApplicable: boolean;
}

export interface ParsedVehicle {
  sheet: string;
  rowNumber: number;
  plate: string;
  className: ClassName;
  brandLine: string | null;
  owner: OwnerRef;
  municipality: string | null;
  serviceType: "PARTICULAR" | "PUBLICO";
  status: ImportedStatus;
  odometerWorking: boolean;
  currentKm: number | null;
  currentKmAt: IsoDate | null;
  tax: { kind: TaxKind; year: number | null };
  /** Null when the cell was empty (no data on record). */
  policy: ParsedDocument | null;
  soat: ParsedDocument | null;
  tecno: ParsedDocument | null;
  driver: { name: string; phone: string | null } | null;
  oilChange: {
    date: IsoDate;
    km: number | null;
    nextKm: number | null;
    nextDate: IsoDate | null;
  } | null;
  sale: { buyer: string | null } | null;
  notes: string[];
  issues: Issue[];
}

export interface RejectedRow {
  sheet: string;
  rowNumber: number;
  plateText: string;
  reason: "invalid_plate" | "duplicate";
  issues: Issue[];
}

export interface SheetResult {
  sheet: string;
  vehicles: ParsedVehicle[];
  rejected: RejectedRow[];
}

export interface ParsedImport {
  sheets: SheetResult[];
  ignoredSheets: string[];
}
