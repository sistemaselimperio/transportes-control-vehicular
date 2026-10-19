/**
 * Pure helpers for the "Hoy" inbox: where an attention item sits on the
 * urgency timeline and how to say it in plain Spanish.
 */
import type { AttentionItem } from "@/modules/dashboard/domain/dashboard-metrics";

export type Urgency = "overdue" | "week" | "month";

/** Last day (inclusive) that still counts as "this week". */
export const WEEK_DAYS = 7;

export const URGENCY_ORDER: readonly Urgency[] = ["overdue", "week", "month"];

type Timed = Pick<AttentionItem, "status" | "daysLeft">;

/**
 * Items with a date go by days left; items without one (tax, km-based oil)
 * go by status: expired is overdue, anything else waits in the 30-day window.
 */
export function urgencyOf(item: Timed): Urgency {
  if (item.status === "expired") return "overdue";
  if (item.daysLeft === null) return "month";
  if (item.daysLeft < 0) return "overdue";
  return item.daysLeft <= WEEK_DAYS ? "week" : "month";
}

/** Splits items into the timeline blocks, keeping the incoming (most urgent first) order. */
export function bucketByUrgency<T extends Timed>(
  items: readonly T[],
): Record<Urgency, T[]> {
  const out: Record<Urgency, T[]> = { overdue: [], week: [], month: [] };
  for (const item of items) out[urgencyOf(item)].push(item);
  return out;
}

/** "hace 3 días", "hoy", "mañana", "en 9 días"; empty when there is no date. */
export function describeDaysLeft(daysLeft: number | null): string {
  if (daysLeft === null) return "";
  if (daysLeft === 0) return "hoy";
  if (daysLeft === 1) return "mañana";
  if (daysLeft === -1) return "hace 1 día";
  return daysLeft < 0 ? `hace ${-daysLeft} días` : `en ${daysLeft} días`;
}
