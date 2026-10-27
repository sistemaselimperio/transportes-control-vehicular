import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { currentDay } from "@/lib/current-day";
import { readTags } from "@/lib/cache-tags";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";
import {
  buildAttentionItems,
  computeKpis,
  filterByGroup,
  type DashboardRow,
  type OwnerGroup,
} from "../domain/dashboard-metrics";

/** One read per request, shared by the page and the layout (sidebar count). */
const loadRows = cache(async (today: IsoDate): Promise<DashboardRow[]> => {
  const gridRows = await listVehicleRows(today);
  return gridRows.map((r) => ({
    plate: r.plate,
    className: r.className,
    ownerName: r.ownerName,
    ownerGroup: r.ownerGroup,
    vehicleStatus: r.vehicleStatus,
    soat: { status: r.soat.status, date: r.soat.date },
    tecno: { status: r.tecno.status, date: r.tecno.date },
    policy: { status: r.policy.status, date: r.policy.date },
    tax: { status: r.tax.status, text: r.tax.text },
    nextChange: { status: r.nextChange.status, text: r.nextChange.text },
  }));
});

export async function getDashboard(group: OwnerGroup | null) {
  return loadDashboard(await currentDay(), group);
}

/** Shared by everyone; `today` is part of the key so the statuses roll over at midnight. */
async function loadDashboard(today: IsoDate, group: OwnerGroup | null) {
  "use cache";
  cacheLife("hours");
  cacheTag(...readTags("dashboard"));

  const rows = filterByGroup(await loadRows(today), group);
  return {
    today,
    group,
    kpis: computeKpis(rows, today),
    attention: buildAttentionItems(rows, today),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export type ExpiredVehicleCounts = Record<OwnerGroup | "ALL", number>;

/** Vehicles with something expired, fleet-wide and per owner group, so the nav can follow `?grupo`. */
export async function getExpiredVehicleCounts(): Promise<ExpiredVehicleCounts> {
  return loadExpiredVehicleCounts(await currentDay());
}

async function loadExpiredVehicleCounts(today: IsoDate): Promise<ExpiredVehicleCounts> {
  "use cache";
  cacheLife("hours");
  cacheTag(...readTags("expiredCounts"));

  const all = await loadRows(today);
  const count = (group: OwnerGroup | null) =>
    computeKpis(filterByGroup(all, group), today).expiredVehicles;
  return {
    ALL: count(null),
    IMPERIO: count("IMPERIO"),
    PAEZ: count("PAEZ"),
    THIRD_PARTY: count("THIRD_PARTY"),
  };
}
