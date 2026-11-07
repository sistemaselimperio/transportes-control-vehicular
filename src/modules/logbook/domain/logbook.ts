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
  gallons: number | null;
  urea: number | null;
  amount: number | null;
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
  { key: "servicios", label: "Mantenimiento" },
  { key: "aceite", label: "Aceite" },
  { key: "llantas", label: "Llantas" },
  { key: "combustible", label: "Combustible" },
];

/** Logbook tabs that apply to a vehicle: a trailer has no engine and is never refueled, so no oil or fuel. */
export function logbookTabsFor({ isTrailer }: { isTrailer: boolean }): ReadonlyArray<{ key: LogbookTab; label: string }> {
  return isTrailer ? LOGBOOK_TABS.filter((t) => t.key !== "aceite" && t.key !== "combustible") : LOGBOOK_TABS;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads the `tab` search param; anything unknown means "servicios". */
export function parseTabParam(value: string | string[] | undefined): LogbookTab {
  const v = first(value);
  return LOGBOOK_TABS.find((t) => t.key === v)?.key ?? "servicios";
}

/** The Bitácora page on one vehicle and tab; without `desde`/`hasta` it shows the whole history. */
export function logbookHref(plate: string, tab: LogbookTab): string {
  return `/bitacora?${new URLSearchParams({ tab, placa: plate })}`;
}

/** Reads a date search param ("YYYY-MM-DD", as an `<input type="date">` sends it); invalid days are dropped. */
export function parseDateParam(value: string | string[] | undefined): IsoDate | null {
  const v = first(value);
  if (v === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? v : null;
}

/** First and last day of a "YYYY-MM" month. */
export function monthBounds(month: string): { from: IsoDate; to: IsoDate } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** Plates are compared without case, spaces or dashes ("abc-12" finds "ABC123"). */
export const normalizePlateQuery = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Rows per page of a vehicle's list. */
export const LOGBOOK_PAGE_SIZE = 50;

/** Longest search text kept. */
export const LOGBOOK_SEARCH_MAX = 80;

const SERVICE_KINDS: readonly ServiceKind[] = ["PREVENTIVE", "CORRECTIVE"];

/** The filters of the fleet-wide logbook; `plate` is already normalized. */
export interface LogbookQuery {
  plate: string;
  /** Inclusive date range; either end may be open. */
  from: IsoDate | null;
  to: IsoDate | null;
  group: OwnerGroup | null;
  /** Free text matched against descriptions, providers and notes; empty for no filter. */
  search: string;
  /** Service kind (only the servicios tab uses it). */
  kind: ServiceKind | null;
  /** Driver who had the vehicle on the record's date. */
  driverId: number | null;
  /** 1-based page of the vehicle's list. */
  page: number;
}

const positiveInt = (value: string | undefined): number | null =>
  value !== undefined && /^\d{1,9}$/.test(value.trim()) && Number(value) >= 1 ? Number(value) : null;

export function parseLogbookQuery(params: {
  placa?: string | string[];
  desde?: string | string[];
  hasta?: string | string[];
  grupo?: string | string[];
  q?: string | string[];
  tipo?: string | string[];
  conductor?: string | string[];
  pagina?: string | string[];
}): LogbookQuery {
  const from = parseDateParam(params.desde);
  const to = parseDateParam(params.hasta);
  const inverted = from !== null && to !== null && from > to;
  const kind = first(params.tipo);
  return {
    plate: normalizePlateQuery(first(params.placa) ?? ""),
    from: inverted ? to : from,
    to: inverted ? from : to,
    group: parseGroupParam(params.grupo),
    search: (first(params.q) ?? "").trim().slice(0, LOGBOOK_SEARCH_MAX).trim(),
    kind: SERVICE_KINDS.find((k) => k === kind) ?? null,
    driverId: positiveInt(first(params.conductor)),
    page: positiveInt(first(params.pagina)) ?? 1,
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

export interface CostSummary {
  count: number;
  total: number;
  withoutPrice: number;
}

export interface FuelSummary {
  count: number;
  gallons: number;
  urea: number;
  amount: number;
}

export function summarizeCost(rows: readonly { price: number | null }[]): CostSummary {
  let total = 0;
  let withoutPrice = 0;
  for (const r of rows) {
    if (r.price === null) withoutPrice += 1;
    else total += r.price;
  }
  return { count: rows.length, total, withoutPrice };
}

export function summarizeFuel(
  rows: readonly { gallons: number | null; urea: number | null; amount: number | null }[],
): FuelSummary {
  // Gallons have two decimals: add in hundredths to avoid float drift. Missing values count as zero.
  const hundredths = (pick: (r: (typeof rows)[number]) => number | null) =>
    rows.reduce((sum, r) => sum + Math.round((pick(r) ?? 0) * 100), 0) / 100;
  return {
    count: rows.length,
    gallons: hundredths((r) => r.gallons),
    urea: hundredths((r) => r.urea),
    amount: rows.reduce((sum, r) => sum + (r.amount ?? 0), 0),
  };
}
