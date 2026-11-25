import type { OrderStatus } from "@/modules/orders/domain/order-rules";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { LoadSupplier } from "./load-rules";

/*
 * An order is loaded in parts, one load per supplier. In a load, for each checked order, the lines of
 * every product of that order belonging to the load's supplier must add up, to the kilogram, to the
 * bags ordered times the current kg per bag.
 */

/** A product line of an order, as the allocation needs it. */
export interface AllocationProduct {
  referenceId: number;
  /** "code · name" of the product. */
  label: string;
  supplier: LoadSupplier | null;
  bags: number;
}

export interface AllocationOrder {
  id: number;
  /** Every line of the order: the ones of other suppliers are ignored. */
  lines: readonly AllocationProduct[];
}

/** A load line: tons of one product taken from one order. */
export interface AllocationLine {
  orderId: number;
  referenceId: number;
  tons: number;
}

export interface AllocationInput {
  /** The supplier of the load. */
  supplier: LoadSupplier;
  /** The current kilograms per bag. */
  kgPerBag: number;
  /** The checked orders. */
  orders: readonly AllocationOrder[];
  lines: readonly AllocationLine[];
}

export interface ProductAllocation {
  referenceId: number;
  label: string;
  bags: number;
  /** bags x kg per bag, rounded to the kilo. */
  expectedKg: number;
  enteredKg: number;
  /** Entered minus expected: negative while kilos are missing. */
  differenceKg: number;
}

export interface OrderAllocation {
  orderId: number;
  /** One entry per product of the order that belongs to the load's supplier. */
  products: ProductAllocation[];
  /** Products with lines that the order does not ask of this supplier. */
  strayReferenceIds: number[];
  lineCount: number;
}

/** Whole kilograms of a ton amount typed with up to three decimals. */
const tonsToKg = (tons: number): number => Math.round(tons * 1000);

export function compareAllocation(input: AllocationInput): OrderAllocation[] {
  return input.orders.map((order) => {
    const expected = new Map<number, { label: string; bags: number }>();
    for (const l of order.lines) {
      if (l.supplier !== input.supplier) continue;
      const known = expected.get(l.referenceId);
      if (known) known.bags += l.bags;
      else expected.set(l.referenceId, { label: l.label, bags: l.bags });
    }
    const lines = input.lines.filter((l) => l.orderId === order.id);
    const entered = new Map<number, number>();
    for (const l of lines) entered.set(l.referenceId, (entered.get(l.referenceId) ?? 0) + tonsToKg(l.tons));

    const products = [...expected].map(([referenceId, { label, bags }]) => {
      const expectedKg = Math.round(bags * input.kgPerBag);
      const enteredKg = entered.get(referenceId) ?? 0;
      return { referenceId, label, bags, expectedKg, enteredKg, differenceKg: enteredKg - expectedKg };
    });
    const strayReferenceIds = [...entered.keys()].filter((id) => !expected.has(id));
    return { orderId: order.id, products, strayReferenceIds, lineCount: lines.length };
  });
}

const kgText = (kg: number): string => `${formatDecimal(Math.abs(kg), 0)} kg`;

/** "faltan 50 kg" / "sobra 1 kg" for a non-zero difference. */
export function differenceText(differenceKg: number): string {
  const amount = Math.abs(differenceKg);
  if (differenceKg < 0) return `${amount === 1 ? "falta" : "faltan"} ${kgText(differenceKg)}`;
  return `${amount === 1 ? "sobra" : "sobran"} ${kgText(differenceKg)}`;
}

/** Every violation of the rule, each naming the order and the product; empty when the load is valid. */
export function allocationErrors(input: AllocationInput): string[] {
  const errors: string[] = [];
  const checked = new Set(input.orders.map((o) => o.id));
  const labels = (order: AllocationOrder) => new Map(order.lines.map((l) => [l.referenceId, l.label]));

  for (const allocation of compareAllocation(input)) {
    const order = input.orders.find((o) => o.id === allocation.orderId);
    if (!order) continue;
    const prefix = `Pedido #${allocation.orderId}`;
    if (allocation.products.length === 0 && allocation.lineCount === 0) {
      errors.push(`${prefix}: no tiene productos de ${input.supplier} por cargar.`);
      continue;
    }
    if (allocation.lineCount === 0) {
      errors.push(`${prefix}: agrega los productos de ${input.supplier} que se cargan.`);
      continue;
    }
    for (const p of allocation.products) {
      if (p.differenceKg !== 0) errors.push(`${prefix} · ${p.label}: ${differenceText(p.differenceKg)}`);
    }
    const known = labels(order);
    for (const id of allocation.strayReferenceIds) {
      errors.push(`${prefix} · ${known.get(id) ?? `producto ${id}`}: este producto no es del pedido para ${input.supplier}`);
    }
  }

  const unchecked = [...new Set(input.lines.map((l) => l.orderId))].filter((id) => !checked.has(id));
  for (const id of unchecked) errors.push(`Pedido #${id}: tiene productos pero no está entre los pedidos elegidos`);
  return errors;
}

/** What decides whether a load of some supplier can take an order. */
export interface LoadableOrder {
  id: number;
  /** Derived status: an annulled order cannot be loaded. */
  status: OrderStatus;
  loads: ReadonlyArray<{ loadId: number; supplier: LoadSupplier }>;
  lines: ReadonlyArray<{ supplier: LoadSupplier | null }>;
}

/**
 * A load of `supplier` can take an order that is not annulled, has products of that supplier and has no
 * other load of that supplier. `ownLoadId` is the load being edited, whose own part stays available.
 */
export function isOrderLoadable(order: LoadableOrder, supplier: LoadSupplier, ownLoadId?: number): boolean {
  if (order.status === "anulado") return false;
  if (!order.lines.some((l) => l.supplier === supplier)) return false;
  return !order.loads.some((l) => l.supplier === supplier && l.loadId !== ownLoadId);
}

/** Ids among `requested` that cannot be part of a load of `supplier`: missing, annulled or already loaded for it. */
export function unavailableOrderIds(
  found: readonly LoadableOrder[],
  requested: readonly number[],
  supplier: LoadSupplier,
  ownLoadId?: number,
): number[] {
  return requested.filter((id) => {
    const order = found.find((o) => o.id === id);
    return !order || !isOrderLoadable(order, supplier, ownLoadId);
  });
}

/** The orders a load of `supplier` can take (the form offers these). */
export function ordersForSupplier<T extends LoadableOrder>(orders: readonly T[], supplier: LoadSupplier | null, ownLoadId?: number): T[] {
  return supplier === null ? [] : orders.filter((o) => isOrderLoadable(o, supplier, ownLoadId));
}
