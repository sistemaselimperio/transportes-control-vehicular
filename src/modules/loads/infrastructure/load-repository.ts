import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { LoadError, SIESA_TAKEN, type LoadPorts, type LoadValues } from "../application/load-commands";
import { productLabel } from "@/modules/orders/domain/catalog";
import { loadKgPerBag, loadOrderRows } from "@/modules/orders/infrastructure/order-repository";
import { findCatalogProducts } from "@/modules/orders/infrastructure/reference-repository";
import type { LoadBalanceRow } from "../domain/load-balance";
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
  const orderIds = [...new Set([...lines.values()].flatMap((ls) => ls.flatMap((l) => (l.orderId === null ? [] : [l.orderId]))))];
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

/** Every balance with its trips (oldest first) and the day of the load that left it. */
export async function loadBalanceRows(): Promise<LoadBalanceRow[]> {
  const [balances, trips] = await Promise.all([
    db
      .select({
        id: schema.loadBalances.id,
        loadId: schema.loadBalances.loadId,
        orderId: schema.loadBalances.orderId,
        supplier: schema.loads.supplier,
        loadDate: schema.loads.date,
        bags: schema.loadBalances.bags,
        scheduledDate: schema.loadBalances.scheduledDate,
        plate: schema.loadBalances.plate,
      })
      .from(schema.loadBalances)
      .innerJoin(schema.loads, eq(schema.loads.id, schema.loadBalances.loadId))
      .orderBy(asc(schema.loadBalances.scheduledDate), asc(schema.loadBalances.id)),
    db
      .select({
        id: schema.loadBalanceTrips.id,
        balanceId: schema.loadBalanceTrips.balanceId,
        date: schema.loadBalanceTrips.date,
        plate: schema.loadBalanceTrips.plate,
        bags: schema.loadBalanceTrips.bags,
      })
      .from(schema.loadBalanceTrips)
      .orderBy(asc(schema.loadBalanceTrips.date), asc(schema.loadBalanceTrips.id)),
  ]);
  const byBalance = new Map<number, LoadBalanceRow["trips"][number][]>();
  for (const { balanceId, ...trip } of trips) byBalance.set(balanceId, [...(byBalance.get(balanceId) ?? []), trip]);
  return balances.map((b) => ({ ...b, trips: byBalance.get(b.id) ?? [] }));
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

const toBalanceColumns = (loadId: number, balances: LoadValues["balances"]) =>
  balances.map((b) => ({ loadId, orderId: b.orderId, bags: b.bags, scheduledDate: b.date, plate: b.plate, vehicleId: b.vehicleId }));

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

/**
 * A SIESA number belongs to exactly one (load, order), so it can repeat across the lines of one order but
 * not across loads, which no unique index can express. Writers of the same number queue on an advisory
 * lock held until the transaction ends (taken in sorted order, so two writers never wait on each other).
 */
async function lockSiesa(tx: Tx, numbers: readonly string[]) {
  for (const n of [...new Set(numbers)].sort()) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"load_siesa:" + n}))`);
}

/** With the lock held, no load outside `ownLoadIds` may hold any of the numbers. */
async function ensureSiesaFree(tx: Tx, ownLoadIds: readonly number[], numbers: readonly string[]) {
  const unique = [...new Set(numbers)];
  if (unique.length === 0) return;
  const taken = await tx
    .select({ id: schema.loadLines.id })
    .from(schema.loadLines)
    .where(and(inArray(schema.loadLines.siesaNumber, unique), notInArray(schema.loadLines.loadId, [...ownLoadIds])))
    .limit(1);
  if (taken.length > 0) throw new LoadError(SIESA_TAKEN);
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
    if (!row) return null;
    const orders = await db
      .selectDistinct({ orderId: schema.loadLines.orderId })
      .from(schema.loadLines)
      .where(eq(schema.loadLines.loadId, id));
    // A free load's lines carry no order.
    return { ...row, orderIds: orders.flatMap((o) => (o.orderId === null ? [] : [o.orderId])) };
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

  async insertLoads(values) {
    try {
      await db.transaction(async (tx) => {
        await lockSiesa(tx, values.flatMap((v) => v.lines.map((l) => l.siesaNumber)));
        const ids: number[] = [];
        for (const v of values) {
          const [load] = await tx.insert(schema.loads).values(toColumns(v)).returning({ id: schema.loads.id });
          if (!load) throw new Error("The load was not stored.");
          ids.push(load.id);
          await tx.insert(schema.loadLines).values(toLineColumns(load.id, v.lines));
          if (v.balances.length > 0) await tx.insert(schema.loadBalances).values(toBalanceColumns(load.id, v.balances));
          await ensureNotLoadedElsewhere(tx, load.id, v.supplier, v.orderIds);
        }
        await ensureSiesaFree(tx, ids, values.flatMap((v) => v.lines.map((l) => l.siesaNumber)));
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
        await lockSiesa(tx, values.lines.map((l) => l.siesaNumber));
        await ensureSiesaFree(tx, [id], values.lines.map((l) => l.siesaNumber));
        // The lines are rewritten whole.
        await tx.delete(schema.loadLines).where(eq(schema.loadLines.loadId, id));
        await tx.insert(schema.loadLines).values(toLineColumns(id, values.lines));
        // With trips registered the balances stay as they are (the command already checked the edit resends them unchanged).
        const [trip] = await tx
          .select({ id: schema.loadBalanceTrips.id })
          .from(schema.loadBalanceTrips)
          .innerJoin(schema.loadBalances, eq(schema.loadBalances.id, schema.loadBalanceTrips.balanceId))
          .where(eq(schema.loadBalances.loadId, id))
          .limit(1);
        if (!trip) {
          await tx.delete(schema.loadBalances).where(eq(schema.loadBalances.loadId, id));
          if (values.balances.length > 0) await tx.insert(schema.loadBalances).values(toBalanceColumns(id, values.balances));
        }
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

  async findLoadBalances(loadId) {
    return db
      .select({
        orderId: schema.loadBalances.orderId,
        bags: schema.loadBalances.bags,
        plate: schema.loadBalances.plate,
        vehicleId: schema.loadBalances.vehicleId,
      })
      .from(schema.loadBalances)
      .where(eq(schema.loadBalances.loadId, loadId));
  },

  async countLoadTrips(loadId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.loadBalanceTrips)
      .innerJoin(schema.loadBalances, eq(schema.loadBalances.id, schema.loadBalanceTrips.balanceId))
      .where(eq(schema.loadBalances.loadId, loadId));
    return row?.n ?? 0;
  },

  async findBalance(id) {
    const [balance] = await db
      .select({ id: schema.loadBalances.id, bags: schema.loadBalances.bags })
      .from(schema.loadBalances)
      .where(eq(schema.loadBalances.id, id))
      .limit(1);
    if (!balance) return null;
    const [carried] = await db
      .select({ n: sql<number>`coalesce(sum(${schema.loadBalanceTrips.bags}), 0)::int` })
      .from(schema.loadBalanceTrips)
      .where(eq(schema.loadBalanceTrips.balanceId, id));
    return { ...balance, carried: carried?.n ?? 0 };
  },

  async insertBalanceTrip(trip, reschedule) {
    return db.transaction(async (tx) => {
      // The row lock serializes the trips of one balance, so the remaining bags are checked against a stable total.
      const [balance] = await tx
        .select({ bags: schema.loadBalances.bags })
        .from(schema.loadBalances)
        .where(eq(schema.loadBalances.id, trip.balanceId))
        .for("update");
      if (!balance) return "gone" as const;
      const [carried] = await tx
        .select({ n: sql<number>`coalesce(sum(${schema.loadBalanceTrips.bags}), 0)::int` })
        .from(schema.loadBalanceTrips)
        .where(eq(schema.loadBalanceTrips.balanceId, trip.balanceId));
      const remaining = balance.bags - (carried?.n ?? 0);
      if (trip.bags > remaining) return "exceeds" as const;
      await tx.insert(schema.loadBalanceTrips).values({
        balanceId: trip.balanceId,
        date: trip.date,
        plate: trip.plate,
        vehicleId: trip.vehicleId,
        bags: trip.bags,
      });
      if (reschedule && remaining - trip.bags > 0) {
        await tx
          .update(schema.loadBalances)
          .set({ scheduledDate: reschedule.date, plate: reschedule.plate, vehicleId: reschedule.vehicleId, updatedAt: new Date() })
          .where(eq(schema.loadBalances.id, trip.balanceId));
      }
      return "ok" as const;
    });
  },

  async deleteBalanceTrip(id) {
    const rows = await db.delete(schema.loadBalanceTrips).where(eq(schema.loadBalanceTrips.id, id)).returning({ id: schema.loadBalanceTrips.id });
    return rows.length === 1;
  },
};
