import type { TabItem } from "@/components/app/tab-bar";

export type HistoryTab = "preoperacionales" | "viajes" | "bitacora";

/** Top-level tabs of the vehicle file's Historial section, in display order. */
export const HISTORY_TABS: ReadonlyArray<TabItem<HistoryTab>> = [
  { key: "preoperacionales", label: "Preoperacionales" },
  { key: "viajes", label: "Viajes" },
  { key: "bitacora", label: "Bitácora" },
];

/** Rows each Historial list shows; a list that reaches it may have more behind "Ver todos". */
export const HISTORY_LIMIT = 10;

/** Reads the `historial` search param; anything unknown means the bitácora. */
export function parseHistoryTab(value: string | string[] | undefined): HistoryTab {
  const v = Array.isArray(value) ? value[0] : value;
  return HISTORY_TABS.find((t) => t.key === v)?.key ?? "bitacora";
}
