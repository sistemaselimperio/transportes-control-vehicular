import { parseGroupParam, type OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";
import type { OilMode } from "@/modules/maintenance/domain/oil-change";
import type { OilChangeValues } from "@/modules/maintenance/domain/oil-items";
import type { IsoDate } from "@/modules/shared/domain/dates";

/* ------------------------------ Records ------------------------------ */

export type ServiceKind = "PREVENTIVE" | "CORRECTIVE";

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  PREVENTIVE: "Preventivo",
  CORRECTIVE: "Correctivo",
};

/** Fields every logbook row shares. */
interface LogRow {
  id: number;
  plate: string;
  date: IsoDate;
  /** Driver assigned to the vehicle on `date`; null when nobody was. */
  driverName: string | null;
}

export interface ServiceRow extends LogRow {
  kind: ServiceKind;
  description: string;
  provider: string | null;
  km: number | null;
  price: number | null;
  notes: string | null;
}

/** An oil change with the vehicle data its edit form needs to recompute the next change. */
export interface OilRow extends LogRow, Omit<OilChangeValues, "id" | "date"> {
  nextDate: IsoDate | null;
  nextKm: number | null;
  odometerWorking: boolean;
  currentKm: number | null;
  oilMode: OilMode;
}

export interface TireRow extends LogRow {
  quantity: number;
  reference: string;
  provider: string | null;
  price: number | null;
  notes: string | null;
}

export interface FuelRow extends LogRow {
  gallons: number;
  amount: number;
  provider: string | null;
}

/** Everything the logbook of one vehicle shows. */
export interface VehicleLogbook {
  services: ServiceRow[];
  oilChanges: OilRow[];
  tires: TireRow[];
  fuel: FuelRow[];
}

/* ----------------------------- Page query ----------------------------- */

export type LogbookTab = "servicios" | "aceite" | "llantas" | "combustible";

export const LOGBOOK_TABS: ReadonlyArray<{ key: LogbookTab; label: string }> = [
  { key: "servicios", label: "Servicios" },
  { key: "aceite", label: "Aceite" },
  { key: "llantas", label: "Llantas" },
  { key: "combustible", label: "Combustible" },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the `tab` search param; anything unknown means "servicios". */
export function parseTabParam(value: string | string[] | undefined): LogbookTab {
  const v = first(value);
  return LOGBOOK_TABS.find((t) => t.key === v)?.key ?? "servicios";
}

/** Reads the `mes` search param ("YYYY-MM", as an `<input type="month">` sends it). */
export function parseMonthParam(value: string | string[] | undefined): string | null {
  const v = first(value);
  return v !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

/** First and last day of a "YYYY-MM" month. */
export function monthBounds(month: string): { from: IsoDate; to: IsoDate } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** Plates are compared without case, spaces or dashes ("abc-12" finds "ABC123"). */
export const normalizePlateQuery = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The filters of the fleet-wide logbook; `plate` is already normalized. */
export interface LogbookQuery {
  plate: string;
  month: string | null;
  group: OwnerGroup | null;
}

export function parseLogbookQuery(params: {
  placa?: string | string[];
  mes?: string | string[];
  grupo?: string | string[];
}): LogbookQuery {
  return {
    plate: normalizePlateQuery(first(params.placa) ?? ""),
    month: parseMonthParam(params.mes),
    group: parseGroupParam(params.grupo),
  };
}

/* ------------------------------ Drivers ------------------------------ */

export interface DriverPeriod {
  id: number;
  driverName: string;
  fromDate: IsoDate;
  toDate: IsoDate | null;
}

/**
 * The driver assigned on a date. On a hand-over day both periods cover it:
 * the one that started later (the newer assignment) wins.
 */
export function driverAtDate(date: IsoDate, periods: readonly DriverPeriod[]): string | null {
  const covering = periods
    .filter((p) => p.fromDate <= date && (p.toDate === null || p.toDate >= date))
    .sort((a, b) => (a.fromDate === b.fromDate ? b.id - a.id : a.fromDate < b.fromDate ? 1 : -1));
  return covering[0]?.driverName ?? null;
}

/* ------------------------------- Totals ------------------------------- */

export function summarizeCost(rows: readonly { price: number | null }[]): {
  count: number;
  total: number;
  withoutPrice: number;
} {
  let total = 0;
  let withoutPrice = 0;
  for (const r of rows) {
    if (r.price === null) withoutPrice += 1;
    else total += r.price;
  }
  return { count: rows.length, total, withoutPrice };
}

export function summarizeFuel(rows: readonly { gallons: number; amount: number }[]): {
  count: number;
  gallons: number;
  amount: number;
} {
  // Gallons have two decimals: add in hundredths to avoid float drift.
  const hundredths = rows.reduce((sum, r) => sum + Math.round(r.gallons * 100), 0);
  return { count: rows.length, gallons: hundredths / 100, amount: rows.reduce((sum, r) => sum + r.amount, 0) };
}
