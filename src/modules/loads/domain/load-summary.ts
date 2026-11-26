import type { IsoDate } from "@/modules/shared/domain/dates";
import { LOAD_SUPPLIERS, type LoadRow, type LoadSupplier } from "./load-rules";

/** One SIESA of a load: the kilos and cost of the lines that carry it. */
export interface SummaryRow {
  siesaNumber: string;
  orderNumber: string;
  /** Whole kilos. */
  kg: number;
  /** Whole pesos (COP). */
  cost: number;
}

export interface SummaryLoad {
  loadId: number;
  plate: string;
  rows: SummaryRow[];
}

export interface SummaryDay {
  date: IsoDate;
  loads: SummaryLoad[];
}

export interface SummarySupplier {
  supplier: LoadSupplier;
  days: SummaryDay[];
}

/** The rows of a load, one per (SIESA, supplier order), in order of first appearance. */
function summaryRows(lines: LoadRow["lines"]): SummaryRow[] {
  const rows = new Map<string, { siesaNumber: string; orderNumber: string; tons: number; cost: number }>();
  for (const l of lines) {
    const key = `${l.siesaNumber}\u0000${l.orderNumber}`;
    const row = rows.get(key) ?? { siesaNumber: l.siesaNumber, orderNumber: l.orderNumber, tons: 0, cost: 0 };
    row.tons += l.tons;
    row.cost += l.cost;
    rows.set(key, row);
  }
  return [...rows.values()].map(({ tons, ...row }) => ({ ...row, kg: Math.round(tons * 1000) }));
}

/**
 * The loads as the notebook writes them: a block per supplier, a group per day (most recent first) and,
 * per load, its plate with one row per SIESA. Loads keep their given order inside a day.
 */
export function buildLoadSummary(loads: readonly LoadRow[]): SummarySupplier[] {
  return LOAD_SUPPLIERS.flatMap((supplier) => {
    const days = new Map<IsoDate, SummaryLoad[]>();
    for (const load of loads) {
      if (load.supplier !== supplier || load.lines.length === 0) continue;
      const day = days.get(load.date) ?? [];
      day.push({ loadId: load.id, plate: load.plate, rows: summaryRows(load.lines) });
      days.set(load.date, day);
    }
    if (days.size === 0) return [];
    const sorted = [...days.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)).map(([date, dayLoads]) => ({ date, loads: dayLoads }));
    return [{ supplier, days: sorted }];
  });
}
