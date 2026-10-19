/**
 * Pure projection of a vehicle and its current data into one grid row:
 * display text plus traffic-light status per cell, using the domain services.
 */
import {
  documentStatus,
  vehicleOverallStatus,
  type AlertStatus,
  type VehicleStatus,
} from "@/modules/alerts/domain/alert-status";
import { taxStatus, type TaxKind } from "@/modules/documents/domain/tax-status";
import {
  nextOilChange,
  oilChangeStatus,
  type OilMode,
} from "@/modules/maintenance/domain/oil-change";
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";

export type OwnerGroup = "IMPERIO" | "PAEZ" | "THIRD_PARTY";

export interface DocumentData {
  kind: "TR" | "RC" | null;
  expiresOn: IsoDate | null;
  notApplicable: boolean;
}

export interface VehicleRowInput {
  vehicle: {
    id: number;
    plate: string;
    status: VehicleStatus;
    odometerWorking: boolean;
    currentKm: number | null;
    brandLine: string | null;
    municipality: string | null;
    serviceType: "PARTICULAR" | "PUBLICO";
    notes: string | null;
    oilMode: OilMode;
  };
  classInfo: {
    name: string;
    oilIntervalKm: number | null;
    oilIntervalMonths: number | null;
    documentsDefaultNotApplicable: boolean;
  };
  owner: { name: string; group: OwnerGroup } | null;
  driver: { name: string; phone: string | null } | null;
  policy: DocumentData | null;
  soat: DocumentData | null;
  tecno: DocumentData | null;
  tax: { kind: TaxKind; year: number | null } | null;
  lastOil: {
    date: IsoDate;
    km: number | null;
    nextKm: number | null;
    nextDate: IsoDate | null;
    intervalKm: number | null;
    intervalMonths: number | null;
  } | null;
  today: IsoDate;
}

export interface Cell {
  text: string;
  status: AlertStatus;
}
export interface DocCell extends Cell {
  date: IsoDate | null;
}

export interface VehicleGridRow {
  id: number;
  plate: string;
  className: string;
  brandLine: string | null;
  ownerName: string | null;
  ownerGroup: OwnerGroup | null;
  policy: DocCell;
  municipality: string | null;
  serviceLabel: string;
  tax: Cell;
  driverName: string | null;
  driverPhone: string | null;
  lastOilDate: IsoDate | null;
  km: number | null;
  odometerWorking: boolean;
  nextChange: Cell;
  soat: DocCell;
  tecno: DocCell;
  vehicleStatus: VehicleStatus;
  statusLabel: string;
  overall: AlertStatus;
  notes: string | null;
}

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  ACTIVE: "Activo",
  IDLE: "Quieta",
  IN_WORKSHOP: "En taller",
  SOLD: "Vendido",
};

export function formatKm(km: number): string {
  return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function documentCell(input: {
  doc: DocumentData | null;
  defaultNotApplicable: boolean;
  sold: boolean;
  today: IsoDate;
  withKind?: boolean;
}): DocCell {
  const { doc, today } = input;
  const notApplicable = doc ? doc.notApplicable : input.defaultNotApplicable;
  const expiresOn = doc?.expiresOn ?? null;
  const status = input.sold
    ? "inactive"
    : documentStatus({ expiresOn, notApplicable, today });

  let text: string;
  if (notApplicable) text = "No aplica";
  else if (!expiresOn) text = "Sin dato";
  else {
    const date = formatDisplayDate(expiresOn);
    text = input.withKind && doc?.kind ? `${doc.kind} ${date}` : date;
  }
  return { text, status, date: expiresOn };
}

function taxCell(
  tax: VehicleRowInput["tax"],
  sold: boolean,
  today: IsoDate,
): Cell {
  const kind: TaxKind = tax?.kind ?? "UNKNOWN";
  const status = sold
    ? "inactive"
    : taxStatus({ kind, year: tax?.year, currentYear: Number(today.slice(0, 4)) });
  switch (kind) {
    case "PAID_YEAR":
      return { text: tax?.year != null ? String(tax.year) : "Sin dato", status };
    case "EXEMPT":
      return { text: "No paga", status };
    case "EXEMPT_LOW_DISPLACEMENT":
      return { text: "No paga (cilindraje)", status };
    case "UNKNOWN":
      return { text: "Sin dato", status };
  }
}

function oilCell(input: VehicleRowInput): Cell {
  const { vehicle, classInfo, lastOil, today } = input;
  const interval = {
    months: lastOil?.intervalMonths ?? classInfo.oilIntervalMonths,
    km: lastOil?.intervalKm ?? classInfo.oilIntervalKm,
  };
  const status = oilChangeStatus({
    vehicleStatus: vehicle.status,
    odometerWorking: vehicle.odometerWorking,
    currentKm: vehicle.currentKm,
    last: lastOil ? { date: lastOil.date, km: lastOil.km } : null,
    interval,
    mode: vehicle.oilMode,
    today,
  });

  if (vehicle.status === "SOLD") return { text: "", status };
  if (vehicle.status === "IDLE") return { text: "Quieta", status };
  if (vehicle.status === "IN_WORKSHOP") return { text: "En taller", status };
  if (status === "not_applicable") return { text: "No aplica", status };
  if (!lastOil) return { text: "Sin registro", status };

  const computed = nextOilChange({
    last: { date: lastOil.date, km: lastOil.km },
    interval,
    mode: vehicle.odometerWorking ? vehicle.oilMode : "date",
  });
  const nextKm = lastOil.nextKm ?? computed.nextKm;
  const nextDate = lastOil.nextDate ?? computed.nextDate;
  const parts = [
    nextKm != null ? `${formatKm(nextKm)} km` : null,
    nextDate ? formatDisplayDate(nextDate) : null,
  ].filter((p): p is string => p !== null);
  return { text: parts.join(" · ") || "Sin dato", status };
}

export function buildVehicleRow(input: VehicleRowInput): VehicleGridRow {
  const { vehicle, classInfo, owner, driver, today } = input;
  const sold = vehicle.status === "SOLD";
  const defaultNa = classInfo.documentsDefaultNotApplicable;

  const policy = documentCell({ doc: input.policy, defaultNotApplicable: defaultNa, sold, today, withKind: true });
  const soat = documentCell({ doc: input.soat, defaultNotApplicable: defaultNa, sold, today });
  const tecno = documentCell({ doc: input.tecno, defaultNotApplicable: defaultNa, sold, today });
  const tax = taxCell(input.tax, sold, today);
  const nextChange = oilCell(input);

  return {
    id: vehicle.id,
    plate: vehicle.plate,
    className: classInfo.name,
    brandLine: vehicle.brandLine,
    ownerName: owner?.name ?? null,
    ownerGroup: owner?.group ?? null,
    policy,
    municipality: vehicle.municipality,
    serviceLabel: vehicle.serviceType === "PUBLICO" ? "Público" : "Particular",
    tax,
    driverName: driver?.name ?? null,
    driverPhone: driver?.phone ?? null,
    lastOilDate: input.lastOil?.date ?? null,
    km: vehicle.currentKm,
    odometerWorking: vehicle.odometerWorking,
    nextChange,
    soat,
    tecno,
    vehicleStatus: vehicle.status,
    statusLabel: STATUS_LABELS[vehicle.status],
    overall: vehicleOverallStatus({
      vehicleStatus: vehicle.status,
      alerts: [policy.status, soat.status, tecno.status, tax.status, nextChange.status],
    }),
    notes: vehicle.notes,
  };
}
