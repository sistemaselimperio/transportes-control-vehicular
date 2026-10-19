/**
 * Fleet "views" (the tabs of /flota): a URL-friendly name for the combinations
 * of status / alert filters people actually use.
 */
import {
  DEFAULT_FILTERS,
  filterVehicleRows,
  type FilterableRow,
  type GroupFilter,
  type VehicleFilters,
} from "./vehicle-filters";

export type FleetView = "activos" | "alertas" | "taller" | "quietas" | "vendidos" | "todos";

export const FLEET_VIEWS: ReadonlyArray<{ key: FleetView; label: string }> = [
  { key: "activos", label: "Activos" },
  { key: "alertas", label: "Con alertas" },
  { key: "taller", label: "En taller" },
  { key: "quietas", label: "Quietas" },
  { key: "vendidos", label: "Vendidos" },
  { key: "todos", label: "Todos" },
];

export const DEFAULT_VIEW: FleetView = "activos";

const VIEW_FILTERS: Record<FleetView, Pick<VehicleFilters, "status" | "onlyAlerts">> = {
  activos: { status: "ACTIVE", onlyAlerts: false },
  alertas: { status: "NOT_SOLD", onlyAlerts: true },
  taller: { status: "IN_WORKSHOP", onlyAlerts: false },
  quietas: { status: "IDLE", onlyAlerts: false },
  vendidos: { status: "SOLD", onlyAlerts: false },
  todos: { status: "ALL", onlyAlerts: false },
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads `?vista=`; anything unknown means the default view. */
export function parseViewParam(value: string | string[] | undefined): FleetView {
  const v = first(value);
  return FLEET_VIEWS.find((view) => view.key === v)?.key ?? DEFAULT_VIEW;
}

/** Full filter state for a view (every other filter at its default). */
export function filtersForView(view: FleetView): VehicleFilters {
  return { ...DEFAULT_FILTERS, ...VIEW_FILTERS[view] };
}

/** Which tab a filter state corresponds to, or null when none does. */
export function viewFromFilters(
  filters: Pick<VehicleFilters, "status" | "onlyAlerts">,
): FleetView | null {
  const match = FLEET_VIEWS.find((v) => {
    const f = VIEW_FILTERS[v.key];
    return f.status === filters.status && f.onlyAlerts === filters.onlyAlerts;
  });
  return match?.key ?? null;
}

/** Row count behind each tab, for the given owner group. */
export function countByView(
  rows: readonly FilterableRow[],
  group: GroupFilter,
): Record<FleetView, number> {
  const counts = {} as Record<FleetView, number>;
  for (const { key } of FLEET_VIEWS) {
    counts[key] = filterVehicleRows(rows, { ...filtersForView(key), group }).length;
  }
  return counts;
}
