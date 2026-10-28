import type { OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";

export const OWNER_GROUPS: readonly OwnerGroup[] = ["IMPERIO", "PAEZ", "THIRD_PARTY"];

export interface OwnerRow {
  id: number;
  name: string;
  documentNumber: string | null;
  group: OwnerGroup;
  /** Plates of the vehicles the owner currently holds. */
  plates: string[];
}

/** Which owners the list shows: everyone, or those holding vehicles today. */
export type OwnerView = "ALL" | "WITH_VEHICLES";

export const OWNER_VIEWS: ReadonlyArray<{ key: OwnerView; label: string }> = [
  { key: "ALL", label: "Todos" },
  { key: "WITH_VEHICLES", label: "Con vehículos" },
];

/** Reads the `vista` search param; only "con-vehiculos" narrows the list. */
export function parseViewParam(value: string | string[] | undefined): OwnerView {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "con-vehiculos" ? "WITH_VEHICLES" : "ALL";
}

export function filterOwnersByGroup<T extends Pick<OwnerRow, "group">>(
  rows: readonly T[],
  group: OwnerGroup | null,
): T[] {
  return group ? rows.filter((r) => r.group === group) : [...rows];
}

const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

/** Documents are compared without dots, spaces or dashes ("1.053.350" finds "1053350927"). */
const normalizeDocument = (s: string) => s.replace(/[.\s-]/g, "");

function matchesQuery(row: OwnerRow, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const doc = normalizeDocument(q);
  return normalizeText(row.name).includes(q) || (doc !== "" && !!row.documentNumber?.includes(doc));
}

export function filterOwnerRows(
  rows: readonly OwnerRow[],
  filters: { view: OwnerView; query: string },
): OwnerRow[] {
  return rows.filter(
    (r) => (filters.view === "ALL" || r.plates.length > 0) && matchesQuery(r, filters.query),
  );
}

/** Tab counts; they follow the search so each tab matches what it will show. */
export function countOwnerViews(rows: readonly OwnerRow[], query: string): Record<OwnerView, number> {
  return {
    WITH_VEHICLES: filterOwnerRows(rows, { view: "WITH_VEHICLES", query }).length,
    ALL: filterOwnerRows(rows, { view: "ALL", query }).length,
  };
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

export function sortOwnerRows<T extends Pick<OwnerRow, "name">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => collator.compare(a.name, b.name));
}
