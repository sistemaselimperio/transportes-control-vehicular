import { productLabel } from "@/modules/orders/domain/catalog";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { LoadLineRow } from "./load-lines";

export const LOAD_SUPPLIERS = ["Finca", "Italcol", "Contegral"] as const;
export type LoadSupplier = (typeof LOAD_SUPPLIERS)[number];

export const isLoadSupplier = (value: unknown): value is LoadSupplier =>
  typeof value === "string" && (LOAD_SUPPLIERS as readonly string[]).includes(value);

/** A product of an order taken by a load, with its bags and the tons of every line of the load that carries it. */
export interface LoadOrderProduct {
  referenceId: number;
  /** "code · name". */
  label: string;
  bags: number;
  tons: number;
}

/** An order (pedido) taking part in a load: only the products this load carries, with what the loads list shows of it. */
export interface LoadOrderBlock {
  id: number;
  deliveryDate: IsoDate;
  /** Free text such as "7–11 a.m.". */
  timeWindow: string | null;
  /** The clients and fincas of the products taken, each once. */
  clients: ReadonlyArray<{ clientName: string; locationName: string | null }>;
  products: readonly LoadOrderProduct[];
  /** Bags of the products taken. */
  bags: number;
}

/** What the grouping needs of an order. */
export interface LoadOrderSource {
  id: number;
  deliveryDate: IsoDate;
  timeWindow: string | null;
  lines: ReadonlyArray<{
    clientName: string;
    locationName: string | null;
    referenceId: number;
    referenceName: string;
    referenceCode: string | null;
    bags: number;
  }>;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000 + 0;

/** One block per order named by the load lines, by order number: its products taken here, their bags and tons. */
export function groupLoadOrders(
  lines: ReadonlyArray<{ orderId: number; referenceId: number | null; tons: number }>,
  orders: readonly LoadOrderSource[],
): LoadOrderBlock[] {
  const byOrder = new Map<number, Map<number, number>>();
  for (const l of lines) {
    if (l.referenceId === null) continue;
    const products = byOrder.get(l.orderId) ?? new Map<number, number>();
    products.set(l.referenceId, (products.get(l.referenceId) ?? 0) + l.tons);
    byOrder.set(l.orderId, products);
  }

  const blocks: LoadOrderBlock[] = [];
  for (const [orderId, taken] of [...byOrder].sort(([x], [y]) => x - y)) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) continue;
    const products = new Map<number, LoadOrderProduct>();
    const clients: Array<{ clientName: string; locationName: string | null }> = [];
    for (const l of order.lines) {
      const tons = taken.get(l.referenceId);
      if (tons === undefined) continue;
      const known = products.get(l.referenceId);
      if (known) known.bags += l.bags;
      else products.set(l.referenceId, { referenceId: l.referenceId, label: productLabel({ code: l.referenceCode, name: l.referenceName }), bags: l.bags, tons: round3(tons) });
      if (!clients.some((c) => c.clientName === l.clientName && c.locationName === l.locationName)) {
        clients.push({ clientName: l.clientName, locationName: l.locationName });
      }
    }
    const list = [...products.values()];
    blocks.push({
      id: order.id,
      deliveryDate: order.deliveryDate,
      timeWindow: order.timeWindow,
      clients,
      products: list,
      bags: list.reduce((sum, p) => sum + p.bags, 0),
    });
  }
  return blocks;
}

/** "#3, #5" and the bags of every order of a load. */
export function summarizeLinkedOrders(orders: ReadonlyArray<Pick<LoadOrderBlock, "id" | "bags">>): { label: string; bags: number } {
  return {
    label: orders.map((o) => `#${o.id}`).join(", "),
    bags: orders.reduce((sum, o) => sum + o.bags, 0),
  };
}

/** The footer of a load block: how many orders and how many bags in all. */
export function loadFooter(orders: ReadonlyArray<Pick<LoadOrderBlock, "bags">>): { orders: number; bags: number } {
  return { orders: orders.length, bags: orders.reduce((sum, o) => sum + o.bags, 0) };
}

export interface LoadRow {
  id: number;
  date: IsoDate;
  supplier: LoadSupplier;
  /** Plate snapshot of the fleet vehicle. */
  plate: string;
  /** Null once the vehicle was deleted. */
  vehicleId: number | null;
  /** Sum of the lines. */
  tons: number;
  /** Whole pesos (COP): the sum of the lines. */
  cost: number;
  /** The products of the load, in the order they were typed. */
  lines: readonly LoadLineRow[];
  notes: string | null;
  /** The orders this load took part of, by order number. */
  orders: readonly LoadOrderBlock[];
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
