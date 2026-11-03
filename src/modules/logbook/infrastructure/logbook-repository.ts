import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import { escapeLikePattern } from "@/modules/shared/domain/like-pattern";
import type { LogbookRepository } from "../application/logbook-ports";
import {
  driverAtDate,
  LOGBOOK_PAGE_SIZE,
  type CostSummary,
  type DriverPeriod,
  type FuelRow,
  type FuelSummary,
  type LogbookQuery,
  type OilRow,
  type ServiceRow,
  type TireRow,
  type VehicleLogbook,
} from "../domain/logbook";

/** What a list is narrowed to: a whole vehicle, or the filters of the fleet-wide page. */
export type LogbookScope = Partial<LogbookQuery> & { vehicleId?: number };

/** The columns a tab's text search looks at, and the service kind column when it has one. */
interface TabFilters {
  search: PgColumn[];
  kind?: PgColumn;
}

/** Every logbook table has `vehicle_id` and `date`; the vehicle is joined for the plate filter. */
function scopeFilter(
  table: { vehicleId: PgColumn; date: PgColumn },
  scope: LogbookScope,
  tab: TabFilters = { search: [] },
): SQL | undefined {
  const pattern = scope.search ? `%${escapeLikePattern(scope.search)}%` : null;
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
    pattern ? or(...tab.search.map((column) => ilike(column, pattern))) : undefined,
    scope.kind && tab.kind ? eq(tab.kind, scope.kind) : undefined,
    scope.driverId != null
      ? sql`exists (
          select 1 from ${schema.driverAssignments}
          where ${schema.driverAssignments.vehicleId} = ${table.vehicleId}
            and ${schema.driverAssignments.driverId} = ${scope.driverId}
            and ${schema.driverAssignments.fromDate} <= ${table.date}
            and (${schema.driverAssignments.toDate} is null or ${schema.driverAssignments.toDate} >= ${table.date})
        )`
      : undefined,
  );
}

const SERVICE_FILTERS: TabFilters = {
  search: [schema.vehicleServices.description, schema.vehicleServices.provider, schema.vehicleServices.notes],
  kind: schema.vehicleServices.kind,
};
const OIL_FILTERS: TabFilters = { search: [schema.oilChanges.notes] };
const TIRE_FILTERS: TabFilters = {
  search: [schema.tireChanges.reference, schema.tireChanges.provider, schema.tireChanges.notes],
};
const FUEL_FILTERS: TabFilters = { search: [schema.fuelFills.provider] };

/** One page of a list: `limit + 1` rows tell whether a next page exists. */
export interface RowsPage<T> {
  rows: T[];
  hasNext: boolean;
}

const pageOffset = (page: number) => (page - 1) * LOGBOOK_PAGE_SIZE;

function toPage<T>(rows: T[]): RowsPage<T> {
  return { rows: rows.slice(0, LOGBOOK_PAGE_SIZE), hasNext: rows.length > LOGBOOK_PAGE_SIZE };
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

async function selectServices(scope: LogbookScope, page?: number) {
  const t = schema.vehicleServices;
  const query = db
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
    .where(scopeFilter(t, scope, SERVICE_FILTERS))
    .orderBy(desc(t.date), desc(t.id))
    .$dynamic();
  return page === undefined ? query : query.limit(LOGBOOK_PAGE_SIZE + 1).offset(pageOffset(page));
}

export async function loadServiceRows(scope: LogbookScope): Promise<ServiceRow[]> {
  return withDrivers(await selectServices(scope));
}

/** One page of services; drivers are resolved for those rows only. */
export async function loadServicePage(scope: LogbookScope, page: number): Promise<RowsPage<ServiceRow>> {
  const found = toPage(await selectServices(scope, page));
  return { rows: await withDrivers(found.rows), hasNext: found.hasNext };
}

async function selectOil(scope: LogbookScope, page?: number) {
  const t = schema.oilChanges;
  const query = db
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
    .where(scopeFilter(t, scope, OIL_FILTERS))
    .orderBy(desc(t.date), desc(t.id))
    .$dynamic();
  return page === undefined ? query : query.limit(LOGBOOK_PAGE_SIZE + 1).offset(pageOffset(page));
}

/** Adds each change's supplies, then its driver. */
async function completeOil(rows: Awaited<ReturnType<typeof selectOil>>): Promise<OilRow[]> {
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

export async function loadOilRows(scope: LogbookScope): Promise<OilRow[]> {
  return completeOil(await selectOil(scope));
}

export async function loadOilPage(scope: LogbookScope, page: number): Promise<RowsPage<OilRow>> {
  const found = toPage(await selectOil(scope, page));
  return { rows: await completeOil(found.rows), hasNext: found.hasNext };
}

async function selectTires(scope: LogbookScope, page?: number) {
  const t = schema.tireChanges;
  const query = db
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
    .where(scopeFilter(t, scope, TIRE_FILTERS))
    .orderBy(desc(t.date), desc(t.id))
    .$dynamic();
  return page === undefined ? query : query.limit(LOGBOOK_PAGE_SIZE + 1).offset(pageOffset(page));
}

export async function loadTireRows(scope: LogbookScope): Promise<TireRow[]> {
  return withDrivers(await selectTires(scope));
}

export async function loadTirePage(scope: LogbookScope, page: number): Promise<RowsPage<TireRow>> {
  const found = toPage(await selectTires(scope, page));
  return { rows: await withDrivers(found.rows), hasNext: found.hasNext };
}

async function selectFuel(scope: LogbookScope, page?: number) {
  const t = schema.fuelFills;
  const query = db
    .select({
      id: t.id,
      vehicleId: t.vehicleId,
      plate: schema.vehicles.plate,
      date: t.date,
      gallons: t.gallons,
      urea: t.urea,
      amount: t.amount,
      provider: t.provider,
    })
    .from(t)
    .innerJoin(schema.vehicles, eq(t.vehicleId, schema.vehicles.id))
    .where(scopeFilter(t, scope, FUEL_FILTERS))
    .orderBy(desc(t.date), desc(t.id))
    .$dynamic();
  return page === undefined ? query : query.limit(LOGBOOK_PAGE_SIZE + 1).offset(pageOffset(page));
}

export async function loadFuelRows(scope: LogbookScope): Promise<FuelRow[]> {
  return withDrivers(await selectFuel(scope));
}

export async function loadFuelPage(scope: LogbookScope, page: number): Promise<RowsPage<FuelRow>> {
  const found = toPage(await selectFuel(scope, page));
  return { rows: await withDrivers(found.rows), hasNext: found.hasNext };
}

/* ------------------------------ Summaries ------------------------------ */

type CostTable = typeof schema.vehicleServices | typeof schema.oilChanges | typeof schema.tireChanges;

/** Totals computed by the database, so thousands of records are never loaded just to be added up. */
async function costSummary(t: CostTable, filters: TabFilters, scope: LogbookScope): Promise<CostSummary> {
  const [row] = await db
    .select({
      count: count(),
      total: sql<number>`coalesce(sum(${t.price}), 0)`.mapWith(Number),
      withoutPrice: sql<number>`count(*) filter (where ${t.price} is null)`.mapWith(Number),
    })
    .from(t)
    .where(scopeFilter(t, scope, filters));
  return row;
}

export const summarizeServices = (scope: LogbookScope) =>
  costSummary(schema.vehicleServices, SERVICE_FILTERS, scope);
export const summarizeOil = (scope: LogbookScope) => costSummary(schema.oilChanges, OIL_FILTERS, scope);
export const summarizeTires = (scope: LogbookScope) => costSummary(schema.tireChanges, TIRE_FILTERS, scope);

export async function summarizeFuelFills(scope: LogbookScope): Promise<FuelSummary> {
  const t = schema.fuelFills;
  const [row] = await db
    .select({
      count: count(),
      gallons: sql<number>`coalesce(sum(${t.gallons}), 0)`.mapWith(Number),
      urea: sql<number>`coalesce(sum(${t.urea}), 0)`.mapWith(Number),
      amount: sql<number>`coalesce(sum(${t.amount}), 0)`.mapWith(Number),
    })
    .from(t)
    .where(scopeFilter(t, scope, FUEL_FILTERS));
  return row;
}

/** The id of the vehicle stored with exactly this plate, or null. */
export async function findVehicleIdByPlate(plate: string): Promise<number | null> {
  const [vehicle] = await db
    .select({ id: schema.vehicles.id })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.plate, plate));
  return vehicle?.id ?? null;
}

/** Every driver who ever had this vehicle, A to Z (for the driver filter). */
export async function loadDriversOfVehicle(vehicleId: number): Promise<Array<{ id: number; name: string }>> {
  return db
    .selectDistinct({ id: schema.drivers.id, name: schema.drivers.name })
    .from(schema.driverAssignments)
    .innerJoin(schema.drivers, eq(schema.driverAssignments.driverId, schema.drivers.id))
    .where(eq(schema.driverAssignments.vehicleId, vehicleId))
    .orderBy(asc(schema.drivers.name), asc(schema.drivers.id));
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
  async removeMany(kind, vehicleId, range) {
    // One DELETE is atomic; the transaction keeps that true if more statements join it later.
    return db.transaction(async (tx) => {
      // Oil supplies go with their change (ON DELETE CASCADE), as in the single delete.
      const t = kind === "oil" ? schema.oilChanges : asEntryTable(kind);
      const deleted = await tx
        .delete(t)
        .where(
          and(
            eq(t.vehicleId, vehicleId),
            range.from ? gte(t.date, range.from) : undefined,
            range.to ? lte(t.date, range.to) : undefined,
          ),
        )
        .returning({ id: t.id });
      return deleted.length;
    });
  },
};
