import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, notExists, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OrderPorts, OrderValues } from "../application/order-commands";
import { DEFAULT_KG_PER_BAG, deriveOrderLoading, isValidKgPerBag, type OrderLineRow, type OrderLoad, type OrderRow } from "../domain/order-rules";
import { findCatalogProducts } from "./reference-repository";

const KG_PER_BAG_KEY = "kg_per_bag";

/** The loads that took part of each order, by order id: one per supplier (a load has a single supplier). */
async function loadOrderLoads(): Promise<Map<number, OrderLoad[]>> {
  const rows = await db
    .selectDistinct({ orderId: schema.loadLines.orderId, loadId: schema.loadLines.loadId, supplier: schema.loads.supplier })
    .from(schema.loadLines)
    .innerJoin(schema.loads, eq(schema.loads.id, schema.loadLines.loadId))
    // The lines of a free load (no order) take part of no order.
    .where(isNotNull(schema.loadLines.orderId))
    .orderBy(asc(schema.loadLines.orderId), asc(schema.loadLines.loadId));
  const byOrder = new Map<number, OrderLoad[]>();
  for (const { orderId, ...load } of rows) {
    if (orderId === null) continue;
    byOrder.set(orderId, [...(byOrder.get(orderId) ?? []), load]);
  }
  return byOrder;
}

/** An order no load has touched yet: the only kind that can be edited or annulled. */
const hasNoLoads = (orderId: number) =>
  notExists(db.select({ one: sql`1` }).from(schema.loadLines).where(eq(schema.loadLines.orderId, orderId)));

/** Every order with its lines and the status derived from its loads, newest delivery day first. */
/** `ids` narrows it to some orders (the loads read just the ones they take part of). */
export async function loadOrderRows(ids?: readonly number[]): Promise<OrderRow[]> {
  if (ids !== undefined && ids.length === 0) return [];
  const orders = await db
    .select()
    .from(schema.orders)
    .where(ids === undefined ? undefined : inArray(schema.orders.id, [...ids]))
    .orderBy(desc(schema.orders.deliveryDate), desc(schema.orders.id));
  if (orders.length === 0) return [];

  const [lines, loadsByOrder] = await Promise.all([
    db
    .select({
      id: schema.orderLines.id,
      orderId: schema.orderLines.orderId,
      clientId: schema.orderLines.clientId,
      clientName: schema.clients.name,
      locationId: schema.orderLines.locationId,
      locationName: schema.clientLocations.name,
      referenceId: schema.orderLines.referenceId,
      referenceName: schema.orderReferences.name,
      referenceCode: schema.orderReferences.code,
      supplier: schema.orderReferences.supplier,
      bags: schema.orderLines.bags,
    })
    .from(schema.orderLines)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.orderLines.clientId))
    .leftJoin(schema.clientLocations, eq(schema.clientLocations.id, schema.orderLines.locationId))
    .innerJoin(schema.orderReferences, eq(schema.orderReferences.id, schema.orderLines.referenceId))
    .where(ids === undefined ? undefined : inArray(schema.orderLines.orderId, [...ids]))
    .orderBy(asc(schema.orderLines.orderId), asc(schema.orderLines.position), asc(schema.orderLines.id)),
    loadOrderLoads(),
  ]);

  const byOrder = new Map<number, OrderLineRow[]>();
  for (const { orderId, ...line } of lines) {
    const list = byOrder.get(orderId) ?? [];
    list.push(line);
    byOrder.set(orderId, list);
  }

  return orders.map((o) => {
    const orderLines = byOrder.get(o.id) ?? [];
    const loads = loadsByOrder.get(o.id) ?? [];
    const loading = deriveOrderLoading(
      o.status,
      orderLines.map((l) => l.supplier),
      loads.map((l) => l.supplier),
      o.deliveredAt,
    );
    return {
      id: o.id,
      deliveryDate: o.deliveryDate,
      timeWindow: o.timeWindow,
      note: o.note,
      deliveredAt: o.deliveredAt,
      ...loading,
      loads,
      lines: orderLines,
    };
  });
}

/** The global kilograms per bag; the default while nobody has set it. */
export async function loadKgPerBag(): Promise<number> {
  const [row] = await db
    .select({ value: schema.comercialSettings.value })
    .from(schema.comercialSettings)
    .where(eq(schema.comercialSettings.key, KG_PER_BAG_KEY))
    .limit(1);
  const value = row ? Number(row.value) : Number.NaN;
  return isValidKgPerBag(value) ? value : DEFAULT_KG_PER_BAG;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const toLineColumns = (orderId: number, lines: OrderValues["lines"]) =>
  lines.map((l, position) => ({
    orderId,
    clientId: l.clientId,
    locationId: l.locationId,
    referenceId: l.referenceId,
    bags: l.bags,
    position,
  }));

async function insertLines(tx: Tx, orderId: number, lines: OrderValues["lines"]) {
  await tx.insert(schema.orderLines).values(toLineColumns(orderId, lines));
}

/** Some order of the delivery stopped being deliverable meanwhile: rolls the transaction back. */
class DeliveryChanged extends Error {}

export const orderRepository: OrderPorts = {
  async findExistingClientIds(ids) {
    if (ids.length === 0) return [];
    const rows = await db.select({ id: schema.clients.id }).from(schema.clients).where(inArray(schema.clients.id, ids));
    return rows.map((r) => r.id);
  },

  async findLocationOwners(ids) {
    if (ids.length === 0) return [];
    return db
      .select({ id: schema.clientLocations.id, clientId: schema.clientLocations.clientId })
      .from(schema.clientLocations)
      .where(inArray(schema.clientLocations.id, ids));
  },

  findCatalogProducts,

  async findOrder(id) {
    const [row] = await db
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);
    if (!row) return null;
    const [load] = await db.select({ id: schema.loadLines.id }).from(schema.loadLines).where(eq(schema.loadLines.orderId, id)).limit(1);
    return { status: row.status, hasLoads: load !== undefined };
  },

  async insertOrder(values) {
    return db.transaction(async (tx) => {
      const [order] = await tx
        .insert(schema.orders)
        .values({ deliveryDate: values.deliveryDate, timeWindow: values.timeWindow, note: values.note })
        .returning({ id: schema.orders.id });
      if (!order) throw new Error("The order was not stored.");
      await insertLines(tx, order.id, values.lines);
      return order.id;
    });
  },

  async replaceOrder(id, values) {
    return db.transaction(async (tx) => {
      // The status and load guards make a concurrent load win: an order a load took part of is never rewritten.
      const updated = await tx
        .update(schema.orders)
        .set({ deliveryDate: values.deliveryDate, timeWindow: values.timeWindow, note: values.note, updatedAt: new Date() })
        .where(and(eq(schema.orders.id, id), eq(schema.orders.status, "pendiente"), hasNoLoads(id)))
        .returning({ id: schema.orders.id });
      if (updated.length !== 1) return false;
      await tx.delete(schema.orderLines).where(eq(schema.orderLines.orderId, id));
      await insertLines(tx, id, values.lines);
      return true;
    });
  },

  async annulOrder(id) {
    const rows = await db
      .update(schema.orders)
      .set({ status: "anulado", updatedAt: new Date() })
      .where(and(eq(schema.orders.id, id), eq(schema.orders.status, "pendiente"), hasNoLoads(id)))
      .returning({ id: schema.orders.id });
    return rows.length === 1;
  },

  async saveKgPerBag(value) {
    await db
      .insert(schema.comercialSettings)
      .values({ key: KG_PER_BAG_KEY, value: String(value) })
      .onConflictDoUpdate({
        target: schema.comercialSettings.key,
        set: { value: String(value), updatedAt: new Date() },
      });
  },

  async findOrdersForDelivery(ids) {
    const rows = await loadOrderRows(ids);
    return rows.map((o) => ({ id: o.id, status: o.status }));
  },

  async findBalances(orderIds) {
    if (orderIds.length === 0) return [];
    const [balances, trips] = await Promise.all([
      db
        .select({ id: schema.loadBalances.id, orderId: schema.loadBalances.orderId, bags: schema.loadBalances.bags })
        .from(schema.loadBalances)
        .where(inArray(schema.loadBalances.orderId, orderIds)),
      db
        .select({ balanceId: schema.loadBalanceTrips.balanceId, bags: schema.loadBalanceTrips.bags })
        .from(schema.loadBalanceTrips)
        .innerJoin(schema.loadBalances, eq(schema.loadBalances.id, schema.loadBalanceTrips.balanceId))
        .where(inArray(schema.loadBalances.orderId, orderIds)),
    ]);
    return balances.map((b) => ({
      orderId: b.orderId,
      bags: b.bags,
      trips: trips.filter((t) => t.balanceId === b.id).map((t) => ({ bags: t.bags })),
    }));
  },

  async findLoadOrderIds(loadId) {
    const rows = await db
      .selectDistinct({ orderId: schema.loadLines.orderId })
      .from(schema.loadLines)
      .where(and(eq(schema.loadLines.loadId, loadId), isNotNull(schema.loadLines.orderId)))
      .orderBy(asc(schema.loadLines.orderId));
    return rows.flatMap((r) => (r.orderId === null ? [] : [r.orderId]));
  },

  async markDelivered(ids, date, by) {
    try {
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(schema.orders)
          .set({ deliveredAt: date, deliveredBy: by, updatedAt: new Date() })
          .where(and(inArray(schema.orders.id, ids), ne(schema.orders.status, "anulado"), isNull(schema.orders.deliveredAt)))
          .returning({ id: schema.orders.id });
        // All or nothing: one order that changed meanwhile undoes the rest.
        if (rows.length !== ids.length) throw new DeliveryChanged();
      });
      return true;
    } catch (e) {
      if (e instanceof DeliveryChanged) return false;
      throw e;
    }
  },

  async clearDelivery(ids) {
    const rows = await db
      .update(schema.orders)
      .set({ deliveredAt: null, deliveredBy: null, updatedAt: new Date() })
      .where(and(inArray(schema.orders.id, ids), isNotNull(schema.orders.deliveredAt)))
      .returning({ id: schema.orders.id });
    return rows.length;
  },
};
