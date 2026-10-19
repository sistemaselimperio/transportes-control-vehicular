import type { OilMode } from "@/modules/maintenance/domain/oil-change";
import { formatDisplayDate, todayInBogota, type IsoDate } from "@/modules/shared/domain/dates";
import { buildVehicleRow, formatKm, type VehicleGridRow, type VehicleRowInput } from "../domain/vehicle-row";
import { mergeTimeline, type TimelineEntry } from "../domain/vehicle-timeline";
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
  /** Owners, drivers, documents, oil changes and sale on one timeline, newest first. */
  timeline: TimelineEntry[];
}

const DOC_LABELS = { SOAT: "SOAT", TECNO: "Tecnomecánica", POLICY: "Póliza" } as const;

const period = (from: string, to: string | null) =>
  `Desde ${formatDisplayDate(from)}${to ? ` hasta ${formatDisplayDate(to)}` : ""}`;

function buildActionContext(
  input: VehicleRowInput,
  people: Pick<VehicleActionContext, "owners" | "drivers" | "imperioOwnerId">,
): VehicleActionContext {
  return {
    today: input.today,
    odometerWorking: input.vehicle.odometerWorking,
    currentKm: input.vehicle.currentKm,
    oilMode: input.vehicle.oilMode,
    oilInterval: {
      months: input.lastOil?.intervalMonths ?? input.classInfo.oilIntervalMonths,
      km: input.lastOil?.intervalKm ?? input.classInfo.oilIntervalKm,
    },
    ...people,
  };
}

/** Just what the action forms need for one vehicle (used by quick actions outside the detail page). */
export async function getVehicleActionContext(plate: string): Promise<VehicleActionContext | null> {
  const [input] = await loadVehicleRowInputs(todayInBogota(), plate);
  if (!input) return null;
  return buildActionContext(input, await loadPeople());
}

export async function getVehicleDetail(plate: string): Promise<VehicleDetail | null> {
  const [input] = await loadVehicleRowInputs(todayInBogota(), plate);
  if (!input) return null;
  const [history, people] = await Promise.all([
    loadVehicleHistory(input.vehicle.id),
    loadPeople(),
  ]);

  const ownerships = history.ownerships.map((o) => ({
    title: o.ownerName,
    detail: period(o.fromDate, o.toDate),
  }));
  const drivers = history.assignments.map((a) => ({
    title: a.driverName,
    detail: `${period(a.fromDate, a.toDate)}${a.phone ? ` · ${a.phone}` : ""}`,
  }));
  const documents = history.documents.map((d) => ({
    title: `${DOC_LABELS[d.type]}${d.policyKind ? ` (${d.policyKind})` : ""}`,
    detail: d.notApplicable
      ? "No aplica"
      : d.expiresOn
        ? `Vence ${formatDisplayDate(d.expiresOn)}`
        : "Sin fecha",
  }));
  const oilChanges = history.oilChanges.map((c) => ({
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
  }));
  const sale = history.sale
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
    : null;

  // Same records, now with the day they happened (documents: the day they were registered).
  const timeline = mergeTimeline([
    ...history.ownerships.map((o, i) => ({
      kind: "owner" as const,
      date: o.fromDate,
      title: ownerships[i].title,
      detail: ownerships[i].detail,
    })),
    ...history.assignments.map((a, i) => ({
      kind: "driver" as const,
      date: a.fromDate,
      title: drivers[i].title,
      detail: drivers[i].detail,
    })),
    ...history.documents.map((d, i) => ({
      kind: "document" as const,
      date: todayInBogota(d.createdAt),
      title: documents[i].title,
      detail: `Registrado · ${documents[i].detail}`,
    })),
    ...history.oilChanges.map((c, i) => ({
      kind: "oil" as const,
      date: c.date,
      title: "Cambio de aceite",
      detail: oilChanges[i].detail,
    })),
    ...(history.sale && sale
      ? [{ kind: "sale" as const, date: history.sale.date ?? null, title: sale.title, detail: sale.detail }]
      : []),
  ]);

  return {
    row: buildVehicleRow(input),
    actions: buildActionContext(input, people),
    ownerships,
    drivers,
    documents,
    oilChanges,
    sale,
    timeline,
  };
}
