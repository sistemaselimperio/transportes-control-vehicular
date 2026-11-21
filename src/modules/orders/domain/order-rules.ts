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
  bags: number;
}

export interface OrderRow {
  /** Shown as the consecutive "Pedido #N". */
  id: number;
  deliveryDate: IsoDate;
  /** Free text such as "7–11 a.m.". */
  timeWindow: string | null;
  note: string | null;
  status: OrderStatus;
  /** The load that picked the order up; set exactly while the status is `cargado`. */
  loadId: number | null;
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

export const isValidKgPerBag = (value: number): boolean => Number.isFinite(value) && value > 0 && value <= MAX_KG_PER_BAG;

/** Only a pending order can be edited or annulled; a loaded or annulled one is locked. */
export const canEditOrder = (status: OrderStatus): boolean => status === "pendiente";

/** The invariant of the model: an order is `cargado` exactly when it has a load. */
export const isStatusConsistent = (status: OrderStatus, loadId: number | null): boolean =>
  (status === "cargado") === (loadId !== null);

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

/**
 * Ids among `requested` that cannot be linked to a load: missing, annulled, or already loaded on a
 * different load. `loadId` is the load being edited, whose own orders stay valid.
 */
export function unavailableOrderIds(
  found: ReadonlyArray<{ id: number; status: OrderStatus; loadId: number | null }>,
  requested: readonly number[],
  loadId?: number,
): number[] {
  return requested.filter((id) => {
    const order = found.find((o) => o.id === id);
    if (!order || order.status === "anulado") return true;
    return order.loadId !== null && order.loadId !== loadId;
  });
}
