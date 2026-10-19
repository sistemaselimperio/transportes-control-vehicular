import type { AlertStatus, VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { OwnerGroup } from "./vehicle-row";

export interface FilterableRow {
  plate: string;
  className: string;
  ownerName: string | null;
  ownerGroup: OwnerGroup | null;
  driverName: string | null;
  vehicleStatus: VehicleStatus;
  overall: AlertStatus;
}

export type GroupFilter = "" | OwnerGroup | "NONE";
/** "NOT_SOLD" is the default view: everything except sold vehicles. */
export type StatusFilter = "NOT_SOLD" | "ALL" | VehicleStatus;

export interface VehicleFilters {
  group: GroupFilter;
  owner: string;
  className: string;
  status: StatusFilter;
  onlyAlerts: boolean;
  search: string;
}

export const DEFAULT_FILTERS: VehicleFilters = {
  group: "",
  owner: "",
  className: "",
  status: "NOT_SOLD",
  onlyAlerts: false,
  search: "",
};

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const plateKey = (s: string) => fold(s).replace(/[\s-]/g, "");

export function filterVehicleRows<T extends FilterableRow>(
  rows: readonly T[],
  f: VehicleFilters,
): T[] {
  const search = fold(f.search).trim();
  const searchPlate = plateKey(f.search);

  return rows.filter((row) => {
    if (f.status === "NOT_SOLD" && row.vehicleStatus === "SOLD") return false;
    if (f.status !== "NOT_SOLD" && f.status !== "ALL" && row.vehicleStatus !== f.status) {
      return false;
    }
    if (f.group === "NONE" ? row.ownerGroup !== null : f.group && row.ownerGroup !== f.group) {
      return false;
    }
    if (f.owner && row.ownerName !== f.owner) return false;
    if (f.className && row.className !== f.className) return false;
    if (f.onlyAlerts && row.overall !== "expired" && row.overall !== "warning") {
      return false;
    }
    if (search) {
      const inPlate = searchPlate !== "" && plateKey(row.plate).includes(searchPlate);
      const inDriver = row.driverName ? fold(row.driverName).includes(search) : false;
      if (!inPlate && !inDriver) return false;
    }
    return true;
  });
}

const GROUPS: readonly GroupFilter[] = ["IMPERIO", "PAEZ", "THIRD_PARTY", "NONE"];
const STATUSES: readonly StatusFilter[] = ["ALL", "ACTIVE", "IDLE", "IN_WORKSHOP", "SOLD"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Initial grid filters from URL search params (`grupo`, `estado`, `alertas=1`); bad values are ignored. */
export function parseFilterParams(
  params: Record<string, string | string[] | undefined>,
): VehicleFilters {
  const group = first(params.grupo);
  const status = first(params.estado);
  return {
    ...DEFAULT_FILTERS,
    group: GROUPS.find((g) => g === group) ?? DEFAULT_FILTERS.group,
    status: STATUSES.find((s) => s === status) ?? DEFAULT_FILTERS.status,
    onlyAlerts: first(params.alertas) === "1",
  };
}
