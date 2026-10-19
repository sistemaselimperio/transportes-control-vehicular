import type { OilMode } from "@/modules/maintenance/domain/oil-change";
import { formatDisplayDate, todayInBogota, type IsoDate } from "@/modules/shared/domain/dates";
import { buildVehicleRow, formatKm, type VehicleGridRow } from "../domain/vehicle-row";
import { loadPeople } from "../infrastructure/vehicle-command-repository";
import {
  loadVehicleHistory,
  loadVehicleRowInputs,
} from "../infrastructure/vehicle-repository";

export async function listVehicleRows(): Promise<VehicleGridRow[]> {
  const inputs = await loadVehicleRowInputs(todayInBogota());
  return inputs.map(buildVehicleRow);
}

export interface HistoryItem {
  title: string;
  detail: string;
}

/** Everything the action forms of the detail page need to prefill and validate. */
export interface VehicleActionContext {
  today: IsoDate;
  odometerWorking: boolean;
  currentKm: number | null;
  oilMode: OilMode;
  /** Interval of the latest oil change, else the class default. */
  oilInterval: { months: number | null; km: number | null };
  owners: Array<{ id: number; name: string }>;
  drivers: Array<{ id: number; name: string; nationalId: string | null }>;
  imperioOwnerId: number | null;
}

export interface VehicleDetail {
  row: VehicleGridRow;
  actions: VehicleActionContext;
  ownerships: HistoryItem[];
  drivers: HistoryItem[];
  documents: HistoryItem[];
  oilChanges: HistoryItem[];
  sale: HistoryItem | null;
}

const DOC_LABELS = { SOAT: "SOAT", TECNO: "Tecnomecánica", POLICY: "Póliza" } as const;

const period = (from: string, to: string | null) =>
  `Desde ${formatDisplayDate(from)}${to ? ` hasta ${formatDisplayDate(to)}` : ""}`;

export async function getVehicleDetail(plate: string): Promise<VehicleDetail | null> {
  const [input] = await loadVehicleRowInputs(todayInBogota(), plate);
  if (!input) return null;
  const [history, people] = await Promise.all([
    loadVehicleHistory(input.vehicle.id),
    loadPeople(),
  ]);

  return {
    row: buildVehicleRow(input),
    actions: {
      today: input.today,
      odometerWorking: input.vehicle.odometerWorking,
      currentKm: input.vehicle.currentKm,
      oilMode: input.vehicle.oilMode,
      oilInterval: {
        months: input.lastOil?.intervalMonths ?? input.classInfo.oilIntervalMonths,
        km: input.lastOil?.intervalKm ?? input.classInfo.oilIntervalKm,
      },
      ...people,
    },
    ownerships: history.ownerships.map((o) => ({
      title: o.ownerName,
      detail: period(o.fromDate, o.toDate),
    })),
    drivers: history.assignments.map((a) => ({
      title: a.driverName,
      detail: `${period(a.fromDate, a.toDate)}${a.phone ? ` · ${a.phone}` : ""}`,
    })),
    documents: history.documents.map((d) => ({
      title: `${DOC_LABELS[d.type]}${d.policyKind ? ` (${d.policyKind})` : ""}`,
      detail: d.notApplicable
        ? "No aplica"
        : d.expiresOn
          ? `Vence ${formatDisplayDate(d.expiresOn)}`
          : "Sin fecha",
    })),
    oilChanges: history.oilChanges.map((c) => ({
      title: formatDisplayDate(c.date),
      detail:
        [
          c.km != null ? `${formatKm(c.km)} km` : null,
          c.nextKm != null ? `próximo a ${formatKm(c.nextKm)} km` : null,
          c.nextDate ? `próximo el ${formatDisplayDate(c.nextDate)}` : null,
          c.notes,
        ]
          .filter(Boolean)
          .join(" · ") || "Sin kilometraje",
    })),
    sale: history.sale
      ? {
          title: history.sale.buyer ?? "Comprador sin registrar",
          detail: [
            history.sale.date
              ? `Vendido el ${formatDisplayDate(history.sale.date)}`
              : "Fecha de venta sin registrar",
            history.sale.price != null ? `$ ${formatKm(history.sale.price)}` : null,
            history.sale.notes,
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : null,
  };
}
