import type { IsoDate } from "@/modules/shared/domain/dates";
import { LOAD_SUPPLIERS, type LoadRow, type LoadSupplier } from "./load-rules";

/** One SIESA of a load: the kilos and cost of the lines that carry it. */
export interface SummaryRow {
  loadId: number;
  siesaNumber: string;
  orderNumber: string;
  /** Whole kilos. */
  kg: number;
  /** Whole pesos (COP). */
  cost: number;
}

/** A plate on a day: the rows of all its loads of that day, with their kilos and cost added. */
export interface SummaryVehicle {
  plate: string;
  kg: number;
  cost: number;
  rows: SummaryRow[];
}

export interface SummaryDay {
  date: IsoDate;
  vehicles: SummaryVehicle[];
}

export interface SummarySupplier {
  supplier: LoadSupplier;
  days: SummaryDay[];
}

/** The rows of a load, one per (SIESA, supplier order), in order of first appearance. */
function summaryRows(load: LoadRow): SummaryRow[] {
  const rows = new Map<string, { siesaNumber: string; orderNumber: string; tons: number; cost: number }>();
  for (const l of load.lines) {
    const key = `${l.siesaNumber}\u0000${l.orderNumber}`;
    const row = rows.get(key) ?? { siesaNumber: l.siesaNumber, orderNumber: l.orderNumber, tons: 0, cost: 0 };
    row.tons += l.tons;
    row.cost += l.cost;
    rows.set(key, row);
  }
  return [...rows.values()].map(({ tons, ...row }) => ({ loadId: load.id, ...row, kg: Math.round(tons * 1000) }));
}

/**
 * The loads as the notebook writes them: a block per supplier, a group per day (most recent first) and,
 * per plate of that day, one row per SIESA of its loads. Plates and rows keep the given order of the loads.
 */
export function buildLoadSummary(loads: readonly LoadRow[]): SummarySupplier[] {
  return LOAD_SUPPLIERS.flatMap((supplier) => {
    const days = new Map<IsoDate, Map<string, SummaryVehicle>>();
    for (const load of loads) {
      if (load.supplier !== supplier || load.lines.length === 0) continue;
      const vehicles = days.get(load.date) ?? new Map<string, SummaryVehicle>();
      const vehicle = vehicles.get(load.plate) ?? { plate: load.plate, kg: 0, cost: 0, rows: [] };
      for (const row of summaryRows(load)) {
        vehicle.rows.push(row);
        vehicle.kg += row.kg;
        vehicle.cost += row.cost;
      }
      vehicles.set(load.plate, vehicle);
      days.set(load.date, vehicles);
    }
    if (days.size === 0) return [];
    const sorted = [...days.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([date, vehicles]) => ({ date, vehicles: [...vehicles.values()] }));
    return [{ supplier, days: sorted }];
  });
}
