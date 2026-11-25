import { clientNames } from "@/modules/orders/domain/order-days";
import { productLabel } from "@/modules/orders/domain/catalog";
import { bagsToKg, kgToTons, productTotals, type OrderRow } from "@/modules/orders/domain/order-rules";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import type { AllocationInput } from "./load-allocation";
import { costOf, groupLinesByOrder, round3, suggestLines, type LoadLineRow } from "./load-lines";
import { LOAD_SUPPLIERS, type LoadSupplier } from "./load-rules";

/*
 * What the loader sees: the pending list (one section per supplier, one row per order that still has a
 * part of it to load) and the drafts of the load form (one block per supplier part of an order).
 */

/** What the pending list and the form need of an order. */
export type PendingSource = Pick<OrderRow, "id" | "status" | "deliveryDate" | "timeWindow" | "pendingSuppliers" | "lines">;

/** Oldest delivery day first; ties keep the order number. */
export const compareByDelivery = (a: Pick<OrderRow, "id" | "deliveryDate">, b: Pick<OrderRow, "id" | "deliveryDate">): number =>
  a.deliveryDate < b.deliveryDate ? -1 : a.deliveryDate > b.deliveryDate ? 1 : a.id - b.id;

/** The suppliers of the order that still have no load, in the fixed supplier order; none once it is annulled or fully loaded. */
export function pendingSuppliersOf(order: Pick<OrderRow, "status" | "pendingSuppliers">): LoadSupplier[] {
  if (order.status !== "pendiente") return [];
  return LOAD_SUPPLIERS.filter((s) => order.pendingSuppliers.includes(s));
}

/** The lines of the order that belong to the supplier. */
const supplierLines = <T extends Pick<OrderRow, "lines">>(order: T, supplier: LoadSupplier) => order.lines.filter((l) => l.supplier === supplier);

const tonsOfBags = (bags: number, kgPerBag: number): number => kgToTons(bagsToKg(bags, kgPerBag));

const sumBags = (lines: ReadonlyArray<{ bags: number }>): number => lines.reduce((sum, l) => sum + l.bags, 0);

export interface PendingProduct {
  referenceId: number;
  label: string;
  bags: number;
  tons: number;
}

/** The part of an order that belongs to one supplier. */
export interface PendingOrderPart {
  supplier: LoadSupplier;
  /** False once that supplier's part has a load. */
  pending: boolean;
  bags: number;
  tons: number;
  /** Most bags first. */
  products: PendingProduct[];
}

/** The whole order split by supplier, in the fixed supplier order. */
export function orderParts(order: PendingSource, kgPerBag: number): PendingOrderPart[] {
  return LOAD_SUPPLIERS.flatMap((supplier) => {
    const lines = supplierLines(order, supplier);
    if (lines.length === 0) return [];
    const bags = sumBags(lines);
    return [
      {
        supplier,
        pending: order.pendingSuppliers.includes(supplier),
        bags,
        tons: tonsOfBags(bags, kgPerBag),
        products: productTotals(lines).map((p) => ({
          referenceId: p.referenceId,
          label: productLabel({ code: p.referenceCode, name: p.referenceName }),
          bags: p.bags,
          tons: tonsOfBags(p.bags, kgPerBag),
        })),
      },
    ];
  });
}

/** One pending order inside the section of a supplier. */
export interface PendingOrderRow {
  id: number;
  deliveryDate: IsoDate;
  timeWindow: string | null;
  /** Clients of the supplier's part. */
  clients: string[];
  /** Bags and tons of this supplier's part. */
  bags: number;
  tons: number;
  /** The other suppliers of the order that are still pending, in the fixed order. */
  otherSuppliers: LoadSupplier[];
  /** The whole order split by supplier, for the detail. */
  parts: PendingOrderPart[];
}

/** Everything still to load of one supplier. */
export interface PendingSection {
  supplier: LoadSupplier;
  /** Delivery day of the oldest pending order. */
  oldestDate: IsoDate;
  /** Oldest delivery first. */
  orders: PendingOrderRow[];
  bags: number;
  tons: number;
}

/** One section per supplier with pending work, in the fixed supplier order; a mixed order shows in each of its pending suppliers. */
export function buildPendingSections(orders: readonly PendingSource[], kgPerBag: number): PendingSection[] {
  const sorted = [...orders].sort(compareByDelivery);
  return LOAD_SUPPLIERS.flatMap((supplier) => {
    const pending = sorted.filter((o) => pendingSuppliersOf(o).includes(supplier));
    const first = pending[0];
    if (!first) return [];
    const rows = pending.map((o): PendingOrderRow => {
      const mine = supplierLines(o, supplier);
      const bags = sumBags(mine);
      return {
        id: o.id,
        deliveryDate: o.deliveryDate,
        timeWindow: o.timeWindow,
        clients: clientNames({ lines: mine }),
        bags,
        tons: tonsOfBags(bags, kgPerBag),
        otherSuppliers: pendingSuppliersOf(o).filter((s) => s !== supplier),
        parts: orderParts(o, kgPerBag),
      };
    });
    const bags = rows.reduce((sum, r) => sum + r.bags, 0);
    return [{ supplier, oldestDate: first.deliveryDate, orders: rows, bags, tons: tonsOfBags(bags, kgPerBag) }];
  });
}

/** A supplier part of an order inside the load: its numbers as typed. */
export interface BlockDraft {
  orderId: number;
  supplier: LoadSupplier;
  siesaNumber: string;
  orderNumber: string;
  /** Total cost of the block, typed with separators. */
  cost: string;
}

/** One product of a block: its tons, as typed. */
export interface ProductDraft {
  key: number;
  orderId: number;
  supplier: LoadSupplier;
  referenceId: number;
  /** "code · name". */
  reference: string;
  tons: string;
}

export interface Drafts {
  blocks: BlockDraft[];
  products: ProductDraft[];
}

/**
 * The form: one block per target (an order and one of its suppliers) with one product line per product
 * the order asks of that supplier, tons suggested from bags x kg per bag. When editing, `stored` fills in
 * what the load already had: tons per product, and the SIESA, supplier order number and cost of each
 * order (the first SIESA / order number when old lines of one order differ; the cost is the sum of its lines).
 */
export function buildDrafts(
  targets: ReadonlyArray<{ order: PendingSource; supplier: LoadSupplier }>,
  kgPerBag: number,
  stored: readonly LoadLineRow[] = [],
): Drafts {
  const storedByOrder = new Map(groupLinesByOrder(stored).map((g) => [g.orderId, g]));
  const blocks: BlockDraft[] = [];
  const products: ProductDraft[] = [];
  let key = 0;
  for (const { order, supplier } of targets) {
    const before = storedByOrder.get(order.id);
    blocks.push({
      orderId: order.id,
      supplier,
      siesaNumber: before?.siesaNumbers[0] ?? "",
      orderNumber: before?.orderNumbers[0] ?? "",
      cost: before ? String(before.cost) : "",
    });
    const storedTons = new Map<number, number>();
    for (const l of before?.lines ?? []) {
      if (l.referenceId !== null) storedTons.set(l.referenceId, (storedTons.get(l.referenceId) ?? 0) + l.tons);
    }
    for (const s of suggestLines([{ id: order.id, lines: supplierLines(order, supplier) }], kgPerBag)) {
      products.push({
        key: key++,
        orderId: order.id,
        supplier,
        referenceId: s.referenceId,
        reference: productLabel({ code: s.referenceCode, name: s.referenceName }),
        tons: String(round3(storedTons.get(s.referenceId) ?? s.tons)),
      });
    }
  }
  return { blocks, products };
}

/** A block the server would accept: SIESA, supplier order and cost filled, every product with tons > 0. */
export function isBlockDraftComplete(block: BlockDraft, products: ReadonlyArray<Pick<ProductDraft, "orderId" | "supplier" | "tons">>): boolean {
  const mine = products.filter((p) => p.orderId === block.orderId && p.supplier === block.supplier);
  return (
    block.siesaNumber.trim() !== "" &&
    block.orderNumber.trim() !== "" &&
    costOf(block.cost) > 0 &&
    mine.length > 0 &&
    mine.every((p) => (parseDecimal(p.tons) ?? 0) > 0)
  );
}

/** What the form shows above the blocks: how many blocks, and the tons and pesos typed so far. */
export function draftsTotals(drafts: Drafts): { blocks: number; tons: number; cost: number } {
  return {
    blocks: drafts.blocks.length,
    tons: round3(drafts.products.reduce((sum, p) => sum + (parseDecimal(p.tons) ?? 0), 0)),
    cost: drafts.blocks.reduce((sum, b) => sum + costOf(b.cost), 0),
  };
}

/** The JSON the server actions parse: each block with its order, supplier, numbers and products. */
export function serializeBlocks(drafts: Drafts): string {
  return JSON.stringify(
    drafts.blocks.map((b) => ({
      orderId: b.orderId,
      supplier: b.supplier,
      siesaNumber: b.siesaNumber,
      orderNumber: b.orderNumber,
      cost: b.cost,
      lines: drafts.products
        .filter((p) => p.orderId === b.orderId && p.supplier === b.supplier)
        .map((p) => ({ referenceId: p.referenceId, tons: p.tons })),
    })),
  );
}

/**
 * One allocation check per supplier among the blocks: the orders of its blocks against the tons typed in
 * them, which is what the server enforces (tons of every product = bags x kg per bag, to the kilogram).
 */
export function allocationInputsOf(
  blocks: ReadonlyArray<Pick<BlockDraft, "orderId" | "supplier">>,
  orders: readonly PendingSource[],
  products: ReadonlyArray<Pick<ProductDraft, "orderId" | "supplier" | "referenceId" | "tons">>,
  kgPerBag: number,
): AllocationInput[] {
  return LOAD_SUPPLIERS.flatMap((supplier) => {
    const mine = blocks.filter((b) => b.supplier === supplier);
    if (mine.length === 0) return [];
    const ids = new Set(mine.map((b) => b.orderId));
    return [
      {
        supplier,
        kgPerBag,
        orders: orders
          .filter((o) => ids.has(o.id))
          .map((o) => ({
            id: o.id,
            lines: o.lines.map((l) => ({
              referenceId: l.referenceId,
              label: productLabel({ code: l.referenceCode, name: l.referenceName }),
              supplier: l.supplier,
              bags: l.bags,
            })),
          })),
        lines: products
          .filter((p) => p.supplier === supplier && ids.has(p.orderId))
          .map((p) => ({ orderId: p.orderId, referenceId: p.referenceId, tons: parseDecimal(p.tons) ?? 0 })),
      },
    ];
  });
}
