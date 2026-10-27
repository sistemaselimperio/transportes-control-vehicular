/**
 * The 14 grid columns, grouped the way people read a vehicle:
 * who/what it is, who is behind it, its papers, and its upkeep.
 */
export type ColumnGroupKey = "vehicle" | "people" | "documents" | "maintenance";

export interface ColumnGroupDef {
  key: ColumnGroupKey;
  label: string;
  /** Column ids, in display order. */
  columns: readonly string[];
  /** Identity group: always visible. */
  pinned?: boolean;
}

export const COLUMN_GROUPS: readonly ColumnGroupDef[] = [
  {
    key: "vehicle",
    label: "Vehículo",
    columns: ["className", "plate", "municipality", "service"],
    pinned: true,
  },
  { key: "people", label: "Personas", columns: ["owner", "driver", "phone"] },
  { key: "documents", label: "Documentos", columns: ["policy", "soat", "tecno", "tax"] },
  { key: "maintenance", label: "Mantenimiento", columns: ["lastOil", "km", "nextChange"] },
];

const TOGGLEABLE = new Set<ColumnGroupKey>(
  COLUMN_GROUPS.filter((g) => !g.pinned).map((g) => g.key),
);

/** Reads the stored "people,documents" value; unknown and pinned groups are dropped. */
export function parseHiddenGroups(raw: string | null): Set<ColumnGroupKey> {
  const out = new Set<ColumnGroupKey>();
  for (const part of (raw ?? "").split(",")) {
    const key = part.trim() as ColumnGroupKey;
    if (TOGGLEABLE.has(key)) out.add(key);
  }
  return out;
}

/** Stable (display order) string for storage. */
export function serializeHiddenGroups(hidden: ReadonlySet<ColumnGroupKey>): string {
  return COLUMN_GROUPS.filter((g) => hidden.has(g.key))
    .map((g) => g.key)
    .join(",");
}

export function toggleGroup(
  hidden: ReadonlySet<ColumnGroupKey>,
  key: ColumnGroupKey,
): Set<ColumnGroupKey> {
  const next = new Set(hidden);
  if (!TOGGLEABLE.has(key)) return next;
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Columns that exist only to sort by ("Más urgentes primero") and are never shown. */
export const SORT_ONLY_COLUMNS: readonly string[] = ["status"];

/** TanStack `columnVisibility` state for the hidden groups. */
export function columnVisibility(hidden: ReadonlySet<ColumnGroupKey>): Record<string, boolean> {
  const out: Record<string, boolean> = Object.fromEntries(SORT_ONLY_COLUMNS.map((id) => [id, false]));
  for (const g of COLUMN_GROUPS) {
    for (const id of g.columns) out[id] = !hidden.has(g.key);
  }
  return out;
}
