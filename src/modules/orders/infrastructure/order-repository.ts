import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OrderPorts, OrderValues } from "../application/order-commands";
import { DEFAULT_KG_PER_BAG, isValidKgPerBag, type OrderLineRow, type OrderRow } from "../domain/order-rules";
import { ensureReferences } from "./reference-repository";

const KG_PER_BAG_KEY = "kg_per_bag";

/** Every order with its lines, newest delivery day first. */
export async function loadOrderRows(): Promise<OrderRow[]> {
  const orders = await db
    .select()
    .from(schema.orders)
    .orderBy(desc(schema.orders.deliveryDate), desc(schema.orders.id));
  if (orders.length === 0) return [];

  const lines = await db
    .select({
      id: schema.orderLines.id,
      orderId: schema.orderLines.orderId,
      clientId: schema.orderLines.clientId,
      clientName: schema.clients.name,
      locationId: schema.orderLines.locationId,
      locationName: schema.clientLocations.name,
      referenceId: schema.orderLines.referenceId,
      referenceName: schema.orderReferences.name,
      bags: schema.orderLines.bags,
    })
    .from(schema.orderLines)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.orderLines.clientId))
    .leftJoin(schema.clientLocations, eq(schema.clientLocations.id, schema.orderLines.locationId))
    .innerJoin(schema.orderReferences, eq(schema.orderReferences.id, schema.orderLines.referenceId))
    .orderBy(asc(schema.orderLines.orderId), asc(schema.orderLines.position), asc(schema.orderLines.id));

  const byOrder = new Map<number, OrderLineRow[]>();
  for (const { orderId, ...line } of lines) {
    const list = byOrder.get(orderId) ?? [];
    list.push(line);
    byOrder.set(orderId, list);
  }

  return orders.map((o) => ({
    id: o.id,
    deliveryDate: o.deliveryDate,
    timeWindow: o.timeWindow,
    note: o.note,
    status: o.status,
    loadId: o.loadId,
    lines: byOrder.get(o.id) ?? [],
  }));
}

/** Names of the reference catalog, alphabetically. */
export async function loadReferenceNames(): Promise<string[]> {
  const rows = await db.select({ name: schema.orderReferences.name }).from(schema.orderReferences).orderBy(asc(schema.orderReferences.nameKey));
  return rows.map((r) => r.name);
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

  ensureReferences,

  async findOrder(id) {
    const [row] = await db
      .select({ status: schema.orders.status, loadId: schema.orders.loadId })
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);
    return row ?? null;
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
      // The status guard makes a concurrent load win: a loaded order is never rewritten.
      const updated = await tx
        .update(schema.orders)
        .set({ deliveryDate: values.deliveryDate, timeWindow: values.timeWindow, note: values.note, updatedAt: new Date() })
        .where(and(eq(schema.orders.id, id), eq(schema.orders.status, "pendiente")))
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
      .where(and(eq(schema.orders.id, id), eq(schema.orders.status, "pendiente")))
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
};
