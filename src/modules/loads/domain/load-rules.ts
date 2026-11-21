import type { IsoDate } from "@/modules/shared/domain/dates";

export const LOAD_SUPPLIERS = ["Finca", "Italcol", "Contegral"] as const;
export type LoadSupplier = (typeof LOAD_SUPPLIERS)[number];

export const isLoadSupplier = (value: unknown): value is LoadSupplier =>
  typeof value === "string" && (LOAD_SUPPLIERS as readonly string[]).includes(value);

/** A concentrate order (pedido) picked up by a load, with what the loads list shows of it. */
export interface LinkedOrder {
  id: number;
  bags: number;
  lines: ReadonlyArray<{ clientName: string; locationName: string | null }>;
}

/** "#3, #5" and the bags of every linked order, for the loads list. */
export function summarizeLinkedOrders(orders: readonly LinkedOrder[]): { label: string; bags: number } {
  return {
    label: orders.map((o) => `#${o.id}`).join(", "),
    bags: orders.reduce((sum, o) => sum + o.bags, 0),
  };
}

export interface LoadRow {
  id: number;
  date: IsoDate;
  supplier: LoadSupplier;
  /** Plate snapshot of the fleet vehicle. */
  plate: string;
  /** Null once the vehicle was deleted. */
  vehicleId: number | null;
  tons: number;
  /** Whole pesos (COP). */
  cost: number;
  /** Unique across loads. */
  siesaNumber: string;
  orderNumber: string;
  notes: string | null;
  /** The orders this load picked up, oldest first. */
  orders: readonly LinkedOrder[];
}

export interface LoadFilters {
  supplier: LoadSupplier | null;
  /** Inclusive ISO days. */
  from: IsoDate | null;
  to: IsoDate | null;
}

export function filterLoads<T extends Pick<LoadRow, "date" | "supplier">>(rows: readonly T[], filters: LoadFilters): T[] {
  return rows.filter((r) => {
    if (filters.supplier !== null && r.supplier !== filters.supplier) return false;
    if (filters.from !== null && r.date < filters.from) return false;
    if (filters.to !== null && r.date > filters.to) return false;
    return true;
  });
}

export function totalsOfLoads(rows: ReadonlyArray<Pick<LoadRow, "tons" | "cost">>) {
  return {
    count: rows.length,
    tons: rows.reduce((sum, r) => sum + r.tons, 0),
    cost: rows.reduce((sum, r) => sum + r.cost, 0),
  };
}

/** Colombian pesos, no decimals: "$ 1.500.000". */
export function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    useGrouping: "always",
  }).format(value);
}
