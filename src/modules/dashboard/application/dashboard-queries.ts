import { todayInBogota } from "@/modules/shared/domain/dates";
import { listVehicleRows } from "@/modules/vehicles/application/vehicle-queries";
import {
  buildAttentionItems,
  computeKpis,
  filterByGroup,
  type DashboardRow,
  type OwnerGroup,
} from "../domain/dashboard-metrics";

export async function getDashboard(group: OwnerGroup | null) {
  const today = todayInBogota();
  const gridRows = await listVehicleRows();

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
  }));
  const rows = filterByGroup(all, group);

  return {
    today,
    group,
    kpis: computeKpis(rows, today),
    attention: buildAttentionItems(rows, today),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
