import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LoadPorts, LoadValues } from "../application/load-commands";
import { productLabel } from "@/modules/orders/domain/catalog";
import { loadKgPerBag, loadOrderRows } from "@/modules/orders/infrastructure/order-repository";
import { findCatalogProducts } from "@/modules/orders/infrastructure/reference-repository";
import { loadTotals, type LoadLineRow } from "../domain/load-lines";
import { groupLoadOrders, type LoadRow } from "../domain/load-rules";

/** The product lines of every load, by load id, in the order they were typed. */
async function loadLines(): Promise<Map<number, LoadLineRow[]>> {
  const rows = await db
    .select({
      id: schema.loadLines.id,
      loadId: schema.loadLines.loadId,
      orderId: schema.loadLines.orderId,
      referenceId: schema.loadLines.referenceId,
      referenceName: schema.orderReferences.name,
      referenceCode: schema.orderReferences.code,
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
  const [rows, lines] = await Promise.all([
    db.select().from(schema.loads).orderBy(desc(schema.loads.date), desc(schema.loads.id)),
    loadLines(),
  ]);
  const orderIds = [...new Set([...lines.values()].flatMap((ls) => ls.map((l) => l.orderId)))];
  const orders = await loadOrderRows(orderIds);
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    supplier: r.supplier,
    plate: r.plate,
    vehicleId: r.vehicleId,
    ...loadTotals(lines.get(r.id) ?? []),
    lines: lines.get(r.id) ?? [],
    notes: r.notes,
    orders: groupLoadOrders(lines.get(r.id) ?? [], orders),
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
    orderId: l.orderId,
    referenceId: l.referenceId,
    tons: l.tons,
    cost: l.cost,
    siesaNumber: l.siesaNumber,
    orderNumber: l.orderNumber,
    position,
  }));

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A checked order stopped being available for the supplier: aborts the transaction so nothing of the load is stored. */
class OrdersUnavailable extends Error {}

/** No other load of the same supplier may already hold a part of the orders: one load per supplier and order. */
async function ensureNotLoadedElsewhere(tx: Tx, loadId: number, supplier: LoadValues["supplier"], orderIds: readonly number[]) {
  if (orderIds.length === 0) return;
  const taken = await tx
    .select({ id: schema.loadLines.id })
    .from(schema.loadLines)
    .innerJoin(schema.loads, eq(schema.loads.id, schema.loadLines.loadId))
    .where(and(inArray(schema.loadLines.orderId, [...orderIds]), eq(schema.loads.supplier, supplier), ne(schema.loadLines.loadId, loadId)))
    .limit(1);
  if (taken.length > 0) throw new OrdersUnavailable();
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

  findCatalogProducts,

  async findOrdersForLoad(ids) {
    const rows = await loadOrderRows(ids);
    return rows.map((o) => ({
      id: o.id,
      status: o.status,
      loads: o.loads,
      lines: o.lines.map((l) => ({
        referenceId: l.referenceId,
        label: productLabel({ code: l.referenceCode, name: l.referenceName }),
        supplier: l.supplier,
        bags: l.bags,
      })),
    }));
  },

  getKgPerBag: loadKgPerBag,

  async insertLoad(values) {
    try {
      await db.transaction(async (tx) => {
        const [load] = await tx.insert(schema.loads).values(toColumns(values)).returning({ id: schema.loads.id });
        if (!load) throw new Error("The load was not stored.");
        await tx.insert(schema.loadLines).values(toLineColumns(load.id, values.lines));
        await ensureNotLoadedElsewhere(tx, load.id, values.supplier, values.orderIds);
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
        await ensureNotLoadedElsewhere(tx, id, values.supplier, values.orderIds);
        return "ok" as const;
      });
    } catch (e) {
      if (e instanceof OrdersUnavailable) return "orders_unavailable" as const;
      throw e;
    }
  },

  async deleteLoad(id) {
    // The lines go with the load (cascade); the status of its orders is derived, so they fall back by themselves.
    const rows = await db.delete(schema.loads).where(eq(schema.loads.id, id)).returning({ id: schema.loads.id });
    return rows.length === 1;
  },
};
