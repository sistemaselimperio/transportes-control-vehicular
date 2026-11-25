import { bagsToKg, kgToTons } from "@/modules/orders/domain/order-rules";

/**
 * One product of a load. The SIESA number and the supplier order number belong to the order inside the
 * load, so they repeat on every line of the same order; the cost of the order is split across its lines.
 */
export interface LoadLineRow {
  id: number;
  /** The order this line takes its product from. */
  orderId: number;
  /** Null only for lines migrated from the single-product loads: they are replaced by the order's products when edited. */
  referenceId: number | null;
  referenceName: string | null;
  /** Null for lines without a product and for products typed inline before the catalog existed. */
  referenceCode: string | null;
  tons: number;
  /** Whole pesos (COP): this line's share of the order's cost. */
  cost: number;
  /** One per (load, order); loads made order by order may carry a different one on each line. */
  siesaNumber: string;
  /** The supplier's order number. */
  orderNumber: string;
}

export const round3 = (value: number): number => Math.round(value * 1000) / 1000 + 0;

/** Tons and cost of a load: the sum of its lines. */
export function loadTotals(lines: ReadonlyArray<{ tons: number; cost: number }>): { tons: number; cost: number } {
  return {
    tons: round3(lines.reduce((sum, l) => sum + l.tons, 0)),
    cost: lines.reduce((sum, l) => sum + l.cost, 0),
  };
}

/** The first value that appears twice (blanks ignored), or null. */
export function firstDuplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const v of values) {
    if (v === "") continue;
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

/** The lines of one order inside a load, with what the order carries as a whole. */
export interface LoadOrderLines<T extends LoadLineRow = LoadLineRow> {
  orderId: number;
  /** Distinct SIESA numbers of the lines, in order of appearance: exactly one for a load made as a general. */
  siesaNumbers: string[];
  orderNumbers: string[];
  /** Sum of the cost of the lines. */
  cost: number;
  tons: number;
  lines: T[];
}

/** The lines of a load grouped by order, in order of first appearance. */
export function groupLinesByOrder<T extends LoadLineRow>(lines: readonly T[]): LoadOrderLines<T>[] {
  const groups = new Map<number, LoadOrderLines<T>>();
  for (const l of lines) {
    const group = groups.get(l.orderId) ?? { orderId: l.orderId, siesaNumbers: [], orderNumbers: [], cost: 0, tons: 0, lines: [] };
    if (!group.siesaNumbers.includes(l.siesaNumber)) group.siesaNumbers.push(l.siesaNumber);
    if (!group.orderNumbers.includes(l.orderNumber)) group.orderNumbers.push(l.orderNumber);
    group.cost += l.cost;
    group.tons = round3(group.tons + l.tons);
    group.lines.push(l);
    groups.set(l.orderId, group);
  }
  return [...groups.values()];
}

/**
 * Splits the total cost of an order (whole pesos) across its lines in proportion to their tons. Every
 * share is a whole number and the last line takes the remainder, so the shares add up to `total` exactly.
 */
export function splitCost(total: number, tons: readonly number[]): number[] {
  const weight = tons.reduce((sum, t) => sum + t, 0);
  let left = total;
  return tons.map((t, i) => {
    if (i === tons.length - 1) return left;
    const share = weight > 0 ? Math.min(left, Math.floor((total * t) / weight)) : 0;
    left -= share;
    return share;
  });
}

/** What an order asks for of one product. */
export interface SuggestedLine {
  orderId: number;
  referenceId: number;
  referenceName: string;
  referenceCode: string | null;
  tons: number;
}

interface OrderedProduct {
  referenceId: number;
  referenceName: string;
  referenceCode: string | null;
  bags: number;
}

/** One suggestion per product of each order, tons = bags x kg per bag / 1000. The orders carry only the products of the load supplier. */
export function suggestLines(orders: ReadonlyArray<{ id: number; lines: readonly OrderedProduct[] }>, kgPerBag: number): SuggestedLine[] {
  return orders.flatMap((order) => {
    const byId = new Map<number, OrderedProduct>();
    for (const l of order.lines) {
      const known = byId.get(l.referenceId);
      if (known) known.bags += l.bags;
      else byId.set(l.referenceId, { referenceId: l.referenceId, referenceName: l.referenceName, referenceCode: l.referenceCode, bags: l.bags });
    }
    return [...byId.values()].map(({ bags, ...product }) => ({
      orderId: order.id,
      ...product,
      tons: round3(kgToTons(bagsToKg(bags, kgPerBag))),
    }));
  });
}

/** The whole pesos typed in a cost field ("1.500.000" -> 1500000); 0 when there are no digits. */
export const costOf = (text: string): number => Number(text.replace(/\D/g, "")) || 0;
