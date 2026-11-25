import type { LoadSupplier } from "@/modules/loads/domain/load-rules";
import type { IsoDate } from "@/modules/shared/domain/dates";

export const ORDER_STATUSES = ["pendiente", "cargado", "anulado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  pendiente: "Pendiente",
  cargado: "Cargado",
  anulado: "Anulado",
};

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);

/** What the list shows until the user asks for more: annulled orders stay hidden. */
export const DEFAULT_STATUS_FILTER: readonly OrderStatus[] = ["pendiente", "cargado"];

/** Kilograms per bag until someone changes the setting. */
export const DEFAULT_KG_PER_BAG = 40;
export const MAX_KG_PER_BAG = 1000;

export interface OrderLineRow {
  id: number;
  clientId: number;
  clientName: string;
  locationId: number | null;
  locationName: string | null;
  referenceId: number;
  referenceName: string;
  /** Null for a product typed inline before the catalog existed. */
  referenceCode: string | null;
  /** The catalog supplier of the product; null for a legacy product typed inline before the catalog. */
  supplier: LoadSupplier | null;
  bags: number;
}

/** A load that took part of the order: each supplier of the order is loaded by at most one load. */
export interface OrderLoad {
  loadId: number;
  supplier: LoadSupplier;
}

export interface OrderRow {
  /** Shown as the consecutive "Pedido #N". */
  id: number;
  deliveryDate: IsoDate;
  /** Free text such as "7–11 a.m.". */
  timeWindow: string | null;
  note: string | null;
  /** Derived from the loads: `cargado` once every supplier of its products has a load. */
  status: OrderStatus;
  /** The loads that took part of the order, one per supplier. */
  loads: readonly OrderLoad[];
  /** Some but not all of the suppliers of the order are loaded: a pending order shown as "Cargado parcial". */
  partial: boolean;
  /** The suppliers of the order that still have no load; empty once loaded or annulled. */
  pendingSuppliers: readonly LoadSupplier[];
  lines: readonly OrderLineRow[];
}

/** Rounds away the float noise of products like 3 * 0.1. */
const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  // `+ 0` turns a -0 into 0.
  return Math.round(value * factor) / factor + 0;
};

/** Kilograms of some bags with the current kg per bag; never stored. */
export const bagsToKg = (bags: number, kgPerBag: number): number => round(bags * kgPerBag, 3);

export const kgToTons = (kg: number): number => round(kg / 1000, 6);

export interface Weights {
  bags: number;
  kg: number;
  tons: number;
}

export function orderTotals(lines: ReadonlyArray<Pick<OrderLineRow, "bags">>, kgPerBag: number): Weights {
  const bags = lines.reduce((sum, l) => sum + l.bags, 0);
  const kg = bagsToKg(bags, kgPerBag);
  return { bags, kg, tons: kgToTons(kg) };
}

export function ordersTotals(rows: ReadonlyArray<Pick<OrderRow, "lines">>, kgPerBag: number): Weights & { count: number } {
  const bags = rows.reduce((sum, r) => sum + orderTotals(r.lines, kgPerBag).bags, 0);
  const kg = bagsToKg(bags, kgPerBag);
  return { count: rows.length, bags, kg, tons: kgToTons(kg) };
}

/** Bags per product (by catalog id) across some lines, most bags first, then by name. */
export function productTotals(
  lines: ReadonlyArray<Pick<OrderLineRow, "referenceId" | "referenceName" | "referenceCode" | "bags">>,
): Array<Pick<OrderLineRow, "referenceId" | "referenceName" | "referenceCode" | "bags">> {
  const byId = new Map<number, { referenceId: number; referenceName: string; referenceCode: string | null; bags: number }>();
  for (const l of lines) {
    const known = byId.get(l.referenceId);
    if (known) known.bags += l.bags;
    else byId.set(l.referenceId, { referenceId: l.referenceId, referenceName: l.referenceName, referenceCode: l.referenceCode, bags: l.bags });
  }
  return [...byId.values()].sort((a, b) => b.bags - a.bags || a.referenceName.localeCompare(b.referenceName, "es"));
}

export const isValidKgPerBag = (value: number): boolean => Number.isFinite(value) && value > 0 && value <= MAX_KG_PER_BAG;

/** Only a pending order that no load has touched can be edited or annulled. */
export const canEditOrder = (status: OrderStatus, hasLoads = false): boolean => status === "pendiente" && !hasLoads;

/**
 * Status of an order from its loads (the persisted status only tells annulled from the rest): loaded when
 * every supplier of its products has a load, partially loaded when only some do, pending otherwise.
 * Products without a supplier (legacy) take no part.
 */
export function deriveOrderLoading(
  persisted: OrderStatus,
  lineSuppliers: ReadonlyArray<LoadSupplier | null>,
  loadedSuppliers: readonly LoadSupplier[],
): { status: OrderStatus; partial: boolean; pendingSuppliers: LoadSupplier[] } {
  if (persisted === "anulado") return { status: "anulado", partial: false, pendingSuppliers: [] };
  const suppliers = [...new Set(lineSuppliers.filter((s): s is LoadSupplier => s !== null))];
  const pendingSuppliers = suppliers.filter((s) => !loadedSuppliers.includes(s));
  if (suppliers.length > 0 && pendingSuppliers.length === 0) return { status: "cargado", partial: false, pendingSuppliers };
  return { status: "pendiente", partial: pendingSuppliers.length < suppliers.length, pendingSuppliers };
}

/** The numbers of the loads that took part of the order, ascending, each once. */
export const orderLoadIds = (order: Pick<OrderRow, "loads">): number[] =>
  [...new Set(order.loads.map((l) => l.loadId))].sort((a, b) => a - b);

/** "Cargado parcial" for a partially loaded order, the plain status label otherwise. */
export const orderStatusLabel = (order: Pick<OrderRow, "status" | "partial">): string =>
  order.partial ? "Cargado parcial" : ORDER_STATUS_LABELS[order.status];

/** What is still to load of the order: the lines of the suppliers without a load once it is partially loaded. */
export function remainingLines<T extends Pick<OrderLineRow, "supplier">>(order: {
  lines: readonly T[];
  partial: boolean;
  pendingSuppliers: readonly LoadSupplier[];
}): readonly T[] {
  if (!order.partial) return order.lines;
  return order.lines.filter((l) => l.supplier !== null && order.pendingSuppliers.includes(l.supplier));
}

export interface OrderFilters {
  statuses: readonly OrderStatus[];
  /** Inclusive ISO days. */
  from: IsoDate | null;
  to: IsoDate | null;
}

export function filterOrders<T extends Pick<OrderRow, "status" | "deliveryDate">>(rows: readonly T[], filters: OrderFilters): T[] {
  return rows.filter((r) => {
    if (!filters.statuses.includes(r.status)) return false;
    if (filters.from !== null && r.deliveryDate < filters.from) return false;
    if (filters.to !== null && r.deliveryDate > filters.to) return false;
    return true;
  });
}

/** Tons typed on a load minus the tons its orders add up to; rounded to the kilo. */
export const tonsDifference = (entered: number, expected: number): number => round(entered - expected, 3);
