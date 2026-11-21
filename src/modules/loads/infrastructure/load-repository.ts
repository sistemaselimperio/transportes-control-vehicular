import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LoadPorts, LoadValues } from "../application/load-commands";
import { ensureReferences } from "@/modules/orders/infrastructure/reference-repository";
import { loadTotals, type LoadLineRow } from "../domain/load-lines";
import type { LinkedOrder, LoadRow } from "../domain/load-rules";

/** The orders each load picked up, by load id, with the clients and fincas of their lines. */
async function loadLinkedOrders(): Promise<Map<number, LinkedOrder[]>> {
  const rows = await db
    .select({
      loadId: schema.orders.loadId,
      orderId: schema.orders.id,
      bags: schema.orderLines.bags,
      clientName: schema.clients.name,
      locationName: schema.clientLocations.name,
    })
    .from(schema.orders)
    .innerJoin(schema.orderLines, eq(schema.orderLines.orderId, schema.orders.id))
    .innerJoin(schema.clients, eq(schema.clients.id, schema.orderLines.clientId))
    .leftJoin(schema.clientLocations, eq(schema.clientLocations.id, schema.orderLines.locationId))
    .where(isNotNull(schema.orders.loadId))
    .orderBy(asc(schema.orders.id), asc(schema.orderLines.position), asc(schema.orderLines.id));

  const orders = new Map<number, LinkedOrder & { loadId: number }>();
  for (const r of rows) {
    if (r.loadId === null) continue;
    const order = orders.get(r.orderId) ?? { id: r.orderId, loadId: r.loadId, bags: 0, lines: [] };
    order.bags += r.bags;
    const known = order.lines.some((l) => l.clientName === r.clientName && l.locationName === r.locationName);
    if (!known) (order.lines as Array<{ clientName: string; locationName: string | null }>).push({ clientName: r.clientName, locationName: r.locationName });
    orders.set(r.orderId, order);
  }
  const byLoad = new Map<number, LinkedOrder[]>();
  for (const { loadId, ...order } of orders.values()) byLoad.set(loadId, [...(byLoad.get(loadId) ?? []), order]);
  return byLoad;
}

/** The product lines of every load, by load id, in the order they were typed. */
async function loadLines(): Promise<Map<number, LoadLineRow[]>> {
  const rows = await db
    .select({
      id: schema.loadLines.id,
      loadId: schema.loadLines.loadId,
      referenceId: schema.loadLines.referenceId,
      referenceName: schema.orderReferences.name,
      tons: schema.loadLines.tons,
      cost: schema.loadLines.cost,
      siesaNumber: schema.loadLines.siesaNumber,
      orderNumber: schema.loadLines.orderNumber,
    })
    .from(schema.loadLines)
    .leftJoin(schema.orderReferences, eq(schema.orderReferences.id, schema.loadLines.referenceId))
    .orderBy(asc(schema.loadLines.loadId), asc(schema.loadLines.position), asc(schema.loadLines.id));
  const byLoad = new Map<number, LoadLineRow[]>();
  for (const { loadId, ...line } of rows) byLoad.set(loadId, [...(byLoad.get(loadId) ?? []), line]);
  return byLoad;
}

/** Every load, newest day first. */
export async function loadLoadRows(): Promise<LoadRow[]> {
  const [rows, linked, lines] = await Promise.all([
    db.select().from(schema.loads).orderBy(desc(schema.loads.date), desc(schema.loads.id)),
    loadLinkedOrders(),
    loadLines(),
  ]);
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    supplier: r.supplier,
    plate: r.plate,
    vehicleId: r.vehicleId,
    ...loadTotals(lines.get(r.id) ?? []),
    lines: lines.get(r.id) ?? [],
    notes: r.notes,
    orders: linked.get(r.id) ?? [],
  }));
}

const toColumns = (v: LoadValues) => ({
  date: v.date,
  supplier: v.supplier,
  plate: v.plate,
  vehicleId: v.vehicleId,
  notes: v.notes,
});

const toLineColumns = (loadId: number, lines: LoadValues["lines"]) =>
  lines.map((l, position) => ({
    loadId,
    referenceId: l.referenceId,
    tons: l.tons,
    cost: l.cost,
    siesaNumber: l.siesaNumber,
    orderNumber: l.orderNumber,
    position,
  }));

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A checked order is no longer pending: aborts the transaction so nothing of the load is stored. */
class OrdersUnavailable extends Error {}

/** Marks the orders as loaded by `loadId`; every one must still be pending. */
async function linkOrders(tx: Tx, loadId: number, orderIds: readonly number[]) {
  if (orderIds.length === 0) return;
  const rows = await tx
    .update(schema.orders)
    .set({ status: "cargado", loadId, updatedAt: new Date() })
    .where(and(inArray(schema.orders.id, [...orderIds]), eq(schema.orders.status, "pendiente")))
    .returning({ id: schema.orders.id });
  if (rows.length !== orderIds.length) throw new OrdersUnavailable();
}

/** Returns every order of the load to pending (the status check holds the invariant status = cargado iff load). */
async function releaseOrders(tx: Tx, loadId: number) {
  await tx
    .update(schema.orders)
    .set({ status: "pendiente", loadId: null, updatedAt: new Date() })
    .where(eq(schema.orders.loadId, loadId));
}

export const loadRepository: LoadPorts = {
  async findVehicleByPlate(plate) {
    // A sold vehicle left the fleet: it cannot be picked. No fleet permission is involved: this is
    // a server-side lookup for the commercial role.
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(and(eq(schema.vehicles.plate, plate), ne(schema.vehicles.status, "SOLD")))
      .limit(1);
    return vehicle ?? null;
  },

  async findLoad(id) {
    const [row] = await db
      .select({ plate: schema.loads.plate, vehicleId: schema.loads.vehicleId })
      .from(schema.loads)
      .where(eq(schema.loads.id, id))
      .limit(1);
    return row ?? null;
  },

  async findTakenSiesa(numbers, exceptId) {
    if (numbers.length === 0) return [];
    const rows = await db
      .select({ siesaNumber: schema.loadLines.siesaNumber })
      .from(schema.loadLines)
      .where(and(inArray(schema.loadLines.siesaNumber, numbers), exceptId == null ? undefined : ne(schema.loadLines.loadId, exceptId)));
    return rows.map((r) => r.siesaNumber);
  },

  ensureReferences,

  async findOrdersByIds(ids) {
    if (ids.length === 0) return [];
    return db
      .select({ id: schema.orders.id, status: schema.orders.status, loadId: schema.orders.loadId })
      .from(schema.orders)
      .where(inArray(schema.orders.id, ids));
  },

  async insertLoad(values) {
    try {
      await db.transaction(async (tx) => {
        const [load] = await tx.insert(schema.loads).values(toColumns(values)).returning({ id: schema.loads.id });
        if (!load) throw new Error("The load was not stored.");
        await tx.insert(schema.loadLines).values(toLineColumns(load.id, values.lines));
        await linkOrders(tx, load.id, values.orderIds);
      });
      return true;
    } catch (e) {
      if (e instanceof OrdersUnavailable) return false;
      throw e;
    }
  },

  async updateLoad(id, values) {
    try {
      return await db.transaction(async (tx) => {
        const rows = await tx
          .update(schema.loads)
          .set({ ...toColumns(values), updatedAt: new Date() })
          .where(eq(schema.loads.id, id))
          .returning({ id: schema.loads.id });
        if (rows.length !== 1) return "gone" as const;
        // The lines are rewritten whole: the old ones go first so a kept SIESA number never collides with itself.
        await tx.delete(schema.loadLines).where(eq(schema.loadLines.loadId, id));
        await tx.insert(schema.loadLines).values(toLineColumns(id, values.lines));
        // The orders of the load become exactly the checked ones: unchecked orders go back to pending.
        await releaseOrders(tx, id);
        await linkOrders(tx, id, values.orderIds);
        return "ok" as const;
      });
    } catch (e) {
      if (e instanceof OrdersUnavailable) return "orders_unavailable" as const;
      throw e;
    }
  },

  async deleteLoad(id) {
    return db.transaction(async (tx) => {
      // Before the delete: the foreign key would null `load_id` but leave the order marked as loaded.
      await releaseOrders(tx, id);
      const rows = await tx.delete(schema.loads).where(eq(schema.loads.id, id)).returning({ id: schema.loads.id });
      return rows.length === 1;
    });
  },
};
