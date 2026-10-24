import { and, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import type { LogbookRepository } from "../application/logbook-ports";
import {
  driverAtDate,
  type DriverPeriod,
  type FuelRow,
  type LogbookQuery,
  type OilRow,
  type ServiceRow,
  type TireRow,
  type VehicleLogbook,
} from "../domain/logbook";

/** What a list is narrowed to: a whole vehicle, or the filters of the fleet-wide page. */
export type LogbookScope = Partial<LogbookQuery> & { vehicleId?: number };

/** Every logbook table has `vehicle_id` and `date`; the vehicle is joined for the plate filter. */
function scopeFilter(table: { vehicleId: PgColumn; date: PgColumn }, scope: LogbookScope): SQL | undefined {
  return and(
    scope.vehicleId !== undefined ? eq(table.vehicleId, scope.vehicleId) : undefined,
    // The plate is already reduced to letters and digits, so it holds no LIKE wildcards.
    scope.plate ? sql`replace(${schema.vehicles.plate}, '-', '') like ${`%${scope.plate}%`}` : undefined,
    scope.from ? gte(table.date, scope.from) : undefined,
    scope.to ? lte(table.date, scope.to) : undefined,
    scope.group
      ? inArray(
          table.vehicleId,
          db
            .select({ id: schema.ownerships.vehicleId })
            .from(schema.ownerships)
            .innerJoin(schema.owners, eq(schema.ownerships.ownerId, schema.owners.id))
            .where(and(isNull(schema.ownerships.toDate), eq(schema.owners.group, scope.group))),
        )
      : undefined,
  );
}

/** Adds the driver the vehicle had on each row's date (drivers are never stored on the records). */
async function withDrivers<T extends { vehicleId: number; date: string }>(
  rows: T[],
): Promise<Array<Omit<T, "vehicleId"> & { driverName: string | null }>> {
  if (rows.length === 0) return [];
  const assignments = await db
    .select({
      id: schema.driverAssignments.id,
      vehicleId: schema.driverAssignments.vehicleId,
      driverName: schema.drivers.name,
      fromDate: schema.driverAssignments.fromDate,
      toDate: schema.driverAssignments.toDate,
    })
    .from(schema.driverAssignments)
    .innerJoin(schema.drivers, eq(schema.driverAssignments.driverId, schema.drivers.id))
    .where(inArray(schema.driverAssignments.vehicleId, [...new Set(rows.map((r) => r.vehicleId))]));

  const periods = new Map<number, DriverPeriod[]>();
  for (const { vehicleId, ...period } of assignments) {
    const list = periods.get(vehicleId) ?? [];
    list.push(period);
    periods.set(vehicleId, list);
  }
  return rows.map(({ vehicleId, ...row }) => ({
    ...row,
    driverName: driverAtDate(row.date, periods.get(vehicleId) ?? []),
  }));
}

export async function loadServiceRows(scope: LogbookScope): Promise<ServiceRow[]> {
  const t = schema.vehicleServices;
  const rows = await db
    .select({
      id: t.id,
      vehicleId: t.vehicleId,
      plate: schema.vehicles.plate,
      date: t.date,
      kind: t.kind,
      description: t.description,
      provider: t.provider,
      km: t.km,
      price: t.price,
      notes: t.notes,
    })
    .from(t)
    .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
    .where(scopeFilter(t, scope))
    .orderBy(desc(t.date), desc(t.id));
  return withDrivers(rows);
}

export async function loadOilRows(scope: LogbookScope): Promise<OilRow[]> {
  const t = schema.oilChanges;
  const rows = await db
    .select({
      id: t.id,
      vehicleId: t.vehicleId,
      plate: schema.vehicles.plate,
      date: t.date,
      km: t.km,
      intervalMonths: t.intervalMonths,
      intervalKm: t.intervalKm,
      nextDate: t.nextDate,
      nextKm: t.nextKm,
      price: t.price,
      notes: t.notes,
      odometerWorking: schema.vehicles.odometerWorking,
      currentKm: schema.vehicles.currentKm,
      oilMode: schema.vehicles.oilMode,
    })
    .from(t)
    .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
    .where(scopeFilter(t, scope))
    .orderBy(desc(t.date), desc(t.id));
  if (rows.length === 0) return [];

  const items = await db
    .select()
    .from(schema.oilChangeItems)
    .where(inArray(schema.oilChangeItems.oilChangeId, rows.map((r) => r.id)))
    .orderBy(schema.oilChangeItems.id);
  const byOil = new Map<number, OilItem[]>();
  for (const { oilChangeId, quantity, detail } of items) {
    const list = byOil.get(oilChangeId) ?? [];
    list.push({ quantity, detail });
    byOil.set(oilChangeId, list);
  }
  const withItems = rows.map((r) => ({ ...r, items: byOil.get(r.id) ?? [] }));
  return withDrivers(withItems);
}

export async function loadTireRows(scope: LogbookScope): Promise<TireRow[]> {
  const t = schema.tireChanges;
  const rows = await db
    .select({
      id: t.id,
      vehicleId: t.vehicleId,
      plate: schema.vehicles.plate,
      date: t.date,
      quantity: t.quantity,
      reference: t.reference,
      provider: t.provider,
      price: t.price,
      notes: t.notes,
    })
    .from(t)
    .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
    .where(scopeFilter(t, scope))
    .orderBy(desc(t.date), desc(t.id));
  return withDrivers(rows);
}

export async function loadFuelRows(scope: LogbookScope): Promise<FuelRow[]> {
  const t = schema.fuelFills;
  const rows = await db
    .select({
      id: t.id,
      vehicleId: t.vehicleId,
      plate: schema.vehicles.plate,
      date: t.date,
      gallons: t.gallons,
      amount: t.amount,
      provider: t.provider,
    })
    .from(t)
    .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
    .where(scopeFilter(t, scope))
    .orderBy(desc(t.date), desc(t.id));
  return withDrivers(rows);
}

/** The four lists of one vehicle. */
export async function loadVehicleLogbook(vehicleId: number): Promise<VehicleLogbook> {
  const scope = { vehicleId };
  const [services, oilChanges, tires, fuel] = await Promise.all([
    loadServiceRows(scope),
    loadOilRows(scope),
    loadTireRows(scope),
    loadFuelRows(scope),
  ]);
  return { services, oilChanges, tires, fuel };
}

/** Every provider already typed in a record, A to Z without repeats (case and accents aside). */
export async function loadProviders(): Promise<string[]> {
  const lists = await Promise.all([
    db.selectDistinct({ provider: schema.vehicleServices.provider }).from(schema.vehicleServices),
    db.selectDistinct({ provider: schema.tireChanges.provider }).from(schema.tireChanges),
    db.selectDistinct({ provider: schema.fuelFills.provider }).from(schema.fuelFills),
  ]);
  const seen = new Map<string, string>();
  for (const { provider } of lists.flat()) {
    if (!provider) continue;
    const key = provider.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (!seen.has(key)) seen.set(key, provider);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/* ------------------------------- Writes ------------------------------- */

const TABLES = {
  service: schema.vehicleServices,
  tire: schema.tireChanges,
  fuel: schema.fuelFills,
} as const;

/** The three tables share `id` and `vehicle_id`, which is all the generic operations touch. */
const asEntryTable = (kind: keyof typeof TABLES) => TABLES[kind] as typeof schema.vehicleServices;

export const logbookRepository: LogbookRepository = {
  async findVehicle(plate) {
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, status: schema.vehicles.status })
      .from(schema.vehicles)
      .where(eq(schema.vehicles.plate, plate));
    return vehicle ?? null;
  },
  async findEntryVehicle(kind, id) {
    const t = asEntryTable(kind);
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, status: schema.vehicles.status })
      .from(t)
      .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
      .where(eq(t.id, id));
    return vehicle ?? null;
  },
  async create(kind, vehicleId, values) {
    // Each branch narrows `values` to its kind; the casts only tell TypeScript what the kind already proved.
    if (kind === "service") {
      await db.insert(schema.vehicleServices).values({ ...(values as typeof schema.vehicleServices.$inferInsert), vehicleId });
    } else if (kind === "tire") {
      await db.insert(schema.tireChanges).values({ ...(values as typeof schema.tireChanges.$inferInsert), vehicleId });
    } else {
      await db.insert(schema.fuelFills).values({ ...(values as typeof schema.fuelFills.$inferInsert), vehicleId });
    }
  },
  async update(kind, id, values) {
    if (kind === "service") {
      await db.update(schema.vehicleServices).set(values as typeof schema.vehicleServices.$inferInsert).where(eq(schema.vehicleServices.id, id));
    } else if (kind === "tire") {
      await db.update(schema.tireChanges).set(values as typeof schema.tireChanges.$inferInsert).where(eq(schema.tireChanges.id, id));
    } else {
      await db.update(schema.fuelFills).set(values as typeof schema.fuelFills.$inferInsert).where(eq(schema.fuelFills.id, id));
    }
  },
  async remove(kind, id) {
    const t = asEntryTable(kind);
    await db.delete(t).where(eq(t.id, id));
  },
};
