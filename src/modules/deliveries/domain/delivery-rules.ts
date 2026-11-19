import { daysBetween, type IsoDate } from "@/modules/shared/domain/dates";
import { matchesQuery } from "@/modules/shared/domain/search-key";

export const DELIVERY_SHIFTS = ["1er viaje", "2do viaje", "3er viaje"] as const;
export type DeliveryShift = (typeof DELIVERY_SHIFTS)[number];

export const DELIVERY_PRIORITIES = ["urgente", "normal"] as const;
export type DeliveryPriority = (typeof DELIVERY_PRIORITIES)[number];

export const DELIVERY_STATUSES = ["pendiente", "entregado"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_PRIORITY_LABELS: Record<DeliveryPriority, string> = { urgente: "Urgente", normal: "Normal" };
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = { pendiente: "Pendiente", entregado: "Entregado" };

/** A client whose last delivery is this many days old (or more) is flagged on the alerts tab. */
export const ALERT_THRESHOLD_DAYS = 13;

export const isDeliveryShift = (value: unknown): value is DeliveryShift =>
  typeof value === "string" && (DELIVERY_SHIFTS as readonly string[]).includes(value);

export const isDeliveryStatus = (value: unknown): value is DeliveryStatus =>
  typeof value === "string" && (DELIVERY_STATUSES as readonly string[]).includes(value);

export interface DeliveryRow {
  id: number;
  /** Colombia calendar day, "YYYY-MM-DD". */
  date: IsoDate;
  shift: DeliveryShift;
  priority: DeliveryPriority;
  clientId: number;
  clientName: string;
  clientNit: string | null;
  destinationId: number;
  destinationName: string;
  /** Bags (bultos). */
  quantity: number;
  /** Typed by hand; never derived from `quantity`. */
  weightKg: number;
  status: DeliveryStatus;
  /** Plate snapshot of the vehicle; null when none was chosen. */
  plate: string | null;
  /** Null when no vehicle was chosen or it was deleted. */
  vehicleId: number | null;
  notes: string | null;
}

/** Tons are never stored: always the typed kilograms over 1000. */
export const tonsFromKg = (kg: number): number => kg / 1000;

/** True when the ISO day is a Sunday: no deliveries are made then. */
export function isSunday(date: IsoDate): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).getUTCDay() === 0;
}

export interface DeliveryTotals {
  count: number;
  quantity: number;
  weightKg: number;
  tons: number;
}

export function totalsOf(rows: ReadonlyArray<Pick<DeliveryRow, "quantity" | "weightKg">>): DeliveryTotals {
  const quantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const weightKg = rows.reduce((sum, r) => sum + r.weightKg, 0);
  return { count: rows.length, quantity, weightKg, tons: tonsFromKg(weightKg) };
}

/** Urgent first, then in registration order. */
export function sortDeliveries<T extends Pick<DeliveryRow, "id" | "priority">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const byPriority = Number(b.priority === "urgente") - Number(a.priority === "urgente");
    return byPriority !== 0 ? byPriority : a.id - b.id;
  });
}

export interface ShiftGroup<T> {
  shift: DeliveryShift;
  rows: T[];
  totals: DeliveryTotals;
}

/** The three shifts in order (empty ones included), each with its rows (urgent first) and totals. */
export function groupByShift<T extends Pick<DeliveryRow, "id" | "priority" | "shift" | "quantity" | "weightKg">>(
  rows: readonly T[],
): ShiftGroup<T>[] {
  return DELIVERY_SHIFTS.map((shift) => {
    const inShift = sortDeliveries(rows.filter((r) => r.shift === shift));
    return { shift, rows: inShift, totals: totalsOf(inShift) };
  });
}

export interface DeliveryFilters {
  /** Client name or NIT. */
  query: string;
  destinationId: number | null;
  shift: DeliveryShift | null;
  /** Inclusive ISO days. */
  from: IsoDate | null;
  to: IsoDate | null;
}

export function filterDeliveries<
  T extends Pick<DeliveryRow, "date" | "shift" | "destinationId" | "clientName" | "clientNit">,
>(rows: readonly T[], filters: DeliveryFilters): T[] {
  return rows.filter((r) => {
    if (filters.destinationId !== null && r.destinationId !== filters.destinationId) return false;
    if (filters.shift !== null && r.shift !== filters.shift) return false;
    if (filters.from !== null && r.date < filters.from) return false;
    if (filters.to !== null && r.date > filters.to) return false;
    return matchesQuery([r.clientName, r.clientNit], filters.query);
  });
}

export interface DestinationSummary extends DeliveryTotals {
  destinationId: number;
  destinationName: string;
}

/** Per destination: deliveries, bags, kilograms and tons; the heaviest destination first. */
export function summarizeByDestination(
  rows: ReadonlyArray<Pick<DeliveryRow, "destinationId" | "destinationName" | "quantity" | "weightKg">>,
): DestinationSummary[] {
  const byDestination = new Map<number, { name: string; rows: typeof rows[number][] }>();
  for (const r of rows) {
    const entry = byDestination.get(r.destinationId) ?? { name: r.destinationName, rows: [] };
    entry.rows.push(r);
    byDestination.set(r.destinationId, entry);
  }
  return [...byDestination.entries()]
    .map(([destinationId, { name, rows: list }]) => ({ destinationId, destinationName: name, ...totalsOf(list) }))
    .sort((a, b) => b.weightKg - a.weightKg || a.destinationName.localeCompare(b.destinationName, "es"));
}

export interface ClientLastDelivery {
  id: number;
  name: string;
  nit: string | null;
  /** Date of the client's most recent delivery; null when it has none. */
  lastDeliveryDate: IsoDate | null;
}

export interface ClientAlert extends ClientLastDelivery {
  lastDeliveryDate: IsoDate;
  /** Whole days since the last delivery. */
  daysSince: number;
}

/**
 * Clients whose last delivery is `ALERT_THRESHOLD_DAYS` or more days before `today`, the most overdue
 * first. A client without deliveries is never alerted.
 */
export function computeClientAlerts(clients: readonly ClientLastDelivery[], today: IsoDate): ClientAlert[] {
  const alerts: ClientAlert[] = [];
  for (const c of clients) {
    if (c.lastDeliveryDate === null) continue;
    const daysSince = daysBetween(c.lastDeliveryDate, today);
    if (daysSince >= ALERT_THRESHOLD_DAYS) alerts.push({ ...c, lastDeliveryDate: c.lastDeliveryDate, daysSince });
  }
  return alerts.sort((a, b) => b.daysSince - a.daysSince || a.name.localeCompare(b.name, "es"));
}
