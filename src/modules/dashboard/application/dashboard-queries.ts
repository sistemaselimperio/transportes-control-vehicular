import { todayInBogota } from "@/modules/shared/domain/dates";
import { listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";
import {
  buildAttentionItems,
  computeKpis,
  filterByGroup,
  fleetByClass,
  fleetByGroup,
  migrationProgress,
  pendingOilChanges,
  soldByYear,
  type DashboardRow,
  type OwnerGroup,
} from "../domain/dashboard-metrics";
import { loadSaleDates } from "../infrastructure/dashboard-repository";

export async function getDashboard(group: OwnerGroup | null) {
  const today = todayInBogota();
  const [gridRows, saleDates] = await Promise.all([listVehicleRows(), loadSaleDates()]);

  const all: DashboardRow[] = gridRows.map((r) => ({
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
    soldOn: r.vehicleStatus === "SOLD" ? (saleDates.get(r.id) ?? null) : null,
  }));
  const rows = filterByGroup(all, group);

  return {
    today,
    group,
    kpis: computeKpis(rows, today),
    attention: buildAttentionItems(rows, today),
    byClass: fleetByClass(rows),
    byGroup: fleetByGroup(rows),
    // Migration is a fleet-wide measure: it ignores the owner-group filter.
    migration: migrationProgress(all),
    oil: pendingOilChanges(rows),
    soldByYear: soldByYear(rows),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
