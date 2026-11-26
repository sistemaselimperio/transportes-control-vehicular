import type { OrderRow } from "./order-rules";
import { daysBetween, type IsoDate } from "@/modules/shared/domain/dates";

/** How a delivery day reads against today. */
export type PendingDay = "atrasado" | "hoy" | "manana" | "despues";

export function pendingDay(date: IsoDate, today: IsoDate): PendingDay {
  const days = daysBetween(today, date);
  return days < 0 ? "atrasado" : days === 0 ? "hoy" : days === 1 ? "manana" : "despues";
}

/** The board's columns, in reading order. */
export const PENDING_DAYS: readonly PendingDay[] = ["atrasado", "hoy", "manana", "despues"];

/** Pending orders per board column; each column oldest day first, then by order number. */
export function bucketPendingOrders<T extends Pick<OrderRow, "id" | "deliveryDate">>(
  orders: readonly T[],
  today: IsoDate,
): Record<PendingDay, T[]> {
  const buckets: Record<PendingDay, T[]> = { atrasado: [], hoy: [], manana: [], despues: [] };
  const sorted = [...orders].sort((a, b) =>
    a.deliveryDate < b.deliveryDate ? -1 : a.deliveryDate > b.deliveryDate ? 1 : a.id - b.id,
  );
  for (const o of sorted) buckets[pendingDay(o.deliveryDate, today)].push(o);
  return buckets;
}

/** Whole days an order is past its delivery date; zero when it is not late. */
export const daysLate = (date: IsoDate, today: IsoDate): number => Math.max(0, daysBetween(date, today));

/** The order's clients, each once, in the order its lines name them. */
export function clientNames(order: Pick<OrderRow, "lines">): string[] {
  const seen = new Map<number, string>();
  for (const l of order.lines) if (!seen.has(l.clientId)) seen.set(l.clientId, l.clientName);
  return [...seen.values()];
}

const STATUS_RANK = { pendiente: 0, cargado: 1, entregado: 2, anulado: 3 } as const;

/**
 * The orders page's reading order: what is still to do first (pending, oldest delivery day first),
 * then the history (loaded, delivered, then annulled), newest first. Ties keep the order number.
 */
export function sortOrdersForList<T extends Pick<OrderRow, "id" | "status" | "deliveryDate">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    const byDate = a.deliveryDate < b.deliveryDate ? -1 : a.deliveryDate > b.deliveryDate ? 1 : 0;
    return (a.status === "pendiente" ? byDate : -byDate) || a.id - b.id;
  });
}
