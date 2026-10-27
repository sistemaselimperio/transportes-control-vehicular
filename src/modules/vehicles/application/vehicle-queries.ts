import { loadVehicleLogbook } from "@/modules/logbook/infrastructure/logbook-repository";
import type { VehicleLogbook } from "@/modules/logbook/domain/logbook";
import type { OilMode } from "@/modules/maintenance/domain/oil-change";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import { formatDisplayDate, todayInBogota, type IsoDate } from "@/modules/shared/domain/dates";
import type { VehicleFileItem } from "@/modules/documents/application/vehicle-file-ports";
import { vehicleFileRepository } from "@/modules/documents/infrastructure/vehicle-file-repository";
import { buildVehicleRow, formatKm, type VehicleGridRow, type VehicleRowInput } from "../domain/vehicle-row";
import { loadPeople } from "../infrastructure/vehicle-command-repository";
import {
  loadVehicleEditValues,
  loadVehicleFormLists,
  loadLastOilItems,
  loadVehicleHistory,
  loadVehicleRowInputs,
} from "../infrastructure/vehicle-repository";

export async function listVehicleRows(today: IsoDate): Promise<VehicleGridRow[]> {
  const inputs = await loadVehicleRowInputs(today);
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
  /** Supplies of the latest oil change: the new one starts from them. */
  lastOilItems: OilItem[];
  owners: Array<{ id: number; name: string }>;
  drivers: Array<{ id: number; name: string; nationalId: string | null }>;
  imperioOwnerId: number | null;
}

/** Pickers for the create / edit vehicle forms. */
export interface VehicleFormOptions {
  today: IsoDate;
  classes: Array<{ id: number; name: string }>;
  /** Plates that can tow (not sold). */
  plates: string[];
  owners: Array<{ id: number; name: string }>;
  drivers: Array<{ id: number; name: string; nationalId: string | null }>;
  imperioOwnerId: number | null;
}

/** Current values of the edit form. */
export interface VehicleEditValues {
  plate: string;
  classId: number;
  brandLine: string | null;
  notes: string | null;
  municipality: string | null;
  serviceType: "PARTICULAR" | "PUBLICO";
  oilMode: OilMode;
  towingPlate: string | null;
}

export async function getVehicleFormOptions(): Promise<VehicleFormOptions> {
  const [lists, people] = await Promise.all([loadVehicleFormLists(), loadPeople()]);
  return { today: todayInBogota(), ...lists, ...people };
}

export interface VehicleDetail {
  row: VehicleGridRow;
  actions: VehicleActionContext;
  edit: { values: VehicleEditValues; options: VehicleFormOptions };
  ownerships: HistoryItem[];
  drivers: HistoryItem[];
  logbook: VehicleLogbook;
  sale: HistoryItem | null;
  /** Metadata of the attached files (never their bytes). */
  files: VehicleFileItem[];
}

const period = (from: string, to: string | null) =>
  `Desde ${formatDisplayDate(from)}${to ? ` hasta ${formatDisplayDate(to)}` : ""}`;

function buildActionContext(
  input: VehicleRowInput,
  people: Pick<VehicleActionContext, "owners" | "drivers" | "imperioOwnerId">,
  lastOilItems: OilItem[],
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
    lastOilItems,
    ...people,
  };
}

/** Just what the action forms need for one vehicle (used by quick actions outside the detail page). */
export async function getVehicleActionContext(plate: string): Promise<VehicleActionContext | null> {
  const [input] = await loadVehicleRowInputs(todayInBogota(), plate);
  if (!input) return null;
  const [people, lastOilItems] = await Promise.all([loadPeople(), loadLastOilItems(input.vehicle.id)]);
  return buildActionContext(input, people, lastOilItems);
}

export async function getVehicleDetail(plate: string): Promise<VehicleDetail | null> {
  const [input] = await loadVehicleRowInputs(todayInBogota(), plate);
  if (!input) return null;
  const [history, people, editValues, lists, files, logbook, lastOilItems] = await Promise.all([
    loadVehicleHistory(input.vehicle.id),
    loadPeople(),
    loadVehicleEditValues(plate),
    loadVehicleFormLists(),
    vehicleFileRepository.listByVehicle(input.vehicle.id),
    loadVehicleLogbook(input.vehicle.id),
    loadLastOilItems(input.vehicle.id),
  ]);

  const ownerships = history.ownerships.map((o) => ({
    title: o.ownerName,
    detail: period(o.fromDate, o.toDate),
  }));
  const drivers = history.assignments.map((a) => ({
    title: a.driverName,
    detail: `${period(a.fromDate, a.toDate)}${a.phone ? ` · ${a.phone}` : ""}`,
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

  return {
    row: buildVehicleRow(input),
    actions: buildActionContext(input, people, lastOilItems),
    edit: {
      values: editValues!,
      options: { today: input.today, ...lists, ...people },
    },
    ownerships,
    drivers,
    logbook,
    sale,
    files: files.map(({ id, category, fileName, sizeBytes, uploadedAt }) => ({
      id,
      category,
      fileName,
      sizeBytes,
      uploadedAt,
    })),
  };
}
