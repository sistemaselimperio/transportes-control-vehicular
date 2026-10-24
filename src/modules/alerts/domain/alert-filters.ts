/**
 * Pure filters for the "Alertas" screen: narrow the attention items by kind,
 * status and plate, and count them per kind for the tabs.
 */
import type { AttentionItem, ItemKind } from "@/modules/dashboard/domain/dashboard-metrics";

export type KindFilter = ItemKind | "ALL";
export type StatusFilter = AttentionItem["status"] | "ALL";

export interface AlertFilters {
  kind: KindFilter;
  status: StatusFilter;
  query: string;
}

export const KIND_FILTERS: readonly KindFilter[] = ["ALL", "SOAT", "TECNO", "POLICY", "TAX", "OIL"];
export const STATUS_FILTERS: readonly StatusFilter[] = ["ALL", "expired", "warning"];

/** Plates are compared without case, spaces or dashes ("abc-12" finds "ABC123"). */
const normalizePlate = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");

export function filterAlerts<T extends AttentionItem>(
  items: readonly T[],
  filters: AlertFilters,
): T[] {
  const query = normalizePlate(filters.query);
  return items.filter(
    (i) =>
      (filters.kind === "ALL" || i.kind === filters.kind) &&
      (filters.status === "ALL" || i.status === filters.status) &&
      (!query || normalizePlate(i.plate).includes(query)),
  );
}

export function countByKind(items: readonly AttentionItem[]): Record<KindFilter, number> {
  const out: Record<KindFilter, number> = { ALL: items.length, SOAT: 0, TECNO: 0, POLICY: 0, TAX: 0, OIL: 0 };
  for (const i of items) out[i.kind] += 1;
  return out;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the `tipo` search param; anything unknown means "all". */
export function parseKindParam(value: string | string[] | undefined): KindFilter {
  const v = first(value);
  return KIND_FILTERS.find((k) => k === v) ?? "ALL";
}

/** Reads the `estado` search param; anything unknown means "all". */
export function parseStatusParam(value: string | string[] | undefined): StatusFilter {
  const v = first(value);
  return STATUS_FILTERS.find((s) => s === v) ?? "ALL";
}
