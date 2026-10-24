/**
 * Pure grouping for the "Hoy" inbox: one row per vehicle, one chip per pending
 * item, each vehicle listed once in the group of its most urgent item.
 */
import { filterAlerts, type AlertFilters } from "@/modules/alerts/domain/alert-filters";
import { byUrgency, type AttentionItem } from "@/modules/dashboard/domain/dashboard-metrics";
import { URGENCY_ORDER, urgencyOf, type Urgency } from "./urgency";

export interface QueueVehicle<T extends AttentionItem = AttentionItem> {
  plate: string;
  /** Pending items that pass the filters, most urgent first. */
  items: T[];
}

export interface VehicleGroup<T extends AttentionItem = AttentionItem> {
  urgency: Urgency;
  vehicles: QueueVehicle<T>[];
}

/** Filters first, then groups by plate; only the groups that still have vehicles, in urgency order. */
export function groupVehicles<T extends AttentionItem>(
  items: readonly T[],
  filters: AlertFilters,
): VehicleGroup<T>[] {
  const byPlate = new Map<string, T[]>();
  for (const item of [...filterAlerts(items, filters)].sort(byUrgency)) {
    const list = byPlate.get(item.plate);
    if (list) list.push(item);
    else byPlate.set(item.plate, [item]);
  }

  const out: Record<Urgency, QueueVehicle<T>[]> = { overdue: [], week: [], month: [] };
  // Map keeps insertion order, so vehicles come out ordered by their most urgent item.
  for (const [plate, list] of byPlate) out[urgencyOf(list[0])].push({ plate, items: list });

  return URGENCY_ORDER.filter((u) => out[u].length > 0).map((u) => ({ urgency: u, vehicles: out[u] }));
}
