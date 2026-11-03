import { and, desc, eq, gte, isNotNull, like, lte, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { escapeLikePattern, INSPECTIONS_PAGE_SIZE, type InspectionFilters } from "../domain/inspection-filters";
import { resolveInspectionLinks, type InspectionLinks } from "../domain/inspection-links";
import type { InspectionAnswers, ValidInspection } from "../domain/preoperational-inspection";

const t = schema.preoperationalInspections;
const vehicle = schema.vehicles;
const driver = schema.drivers;

/** What the list shows: no answers and no signature, which are the heavy columns. */
export type InspectionListRow = {
  id: string;
  inspectionDate: string;
  inspectionTime: string;
  plate: string;
  driverName: string;
  route: string;
  hasCriticalFailure: boolean;
  /** Soft links: null when the typed plate / national id matched no registered record. */
  vehicleId: number | null;
  /** The registered spelling of the linked vehicle's plate (the one `/flota/[placa]` uses). */
  vehiclePlate: string | null;
  driverId: number | null;
};

export type InspectionDetail = InspectionListRow & {
  createdAt: Date;
  trailerPlate: string | null;
  driverNationalId: string;
  odometer: string;
  muleNotApplicable: boolean;
  answers: InspectionAnswers;
  signature: string;
  trailerVehicleId: number | null;
  trailerRegisteredPlate: string | null;
  registeredDriverName: string | null;
};

/** One row of a vehicle's own inspections; `asTrailer` tells it was pulled, not driven. */
export type VehicleInspectionRow = {
  id: string;
  inspectionDate: string;
  inspectionTime: string;
  driverName: string;
  hasCriticalFailure: boolean;
  asTrailer: boolean;
};

/**
 * Matches the typed header against the registered vehicles and drivers. A failed lookup only means
 * no links: the submission is saved either way.
 */
async function resolveLinks(value: ValidInspection): Promise<InspectionLinks> {
  try {
    const [vehicles, drivers] = await Promise.all([
      db.select({ id: vehicle.id, plate: vehicle.plate }).from(vehicle),
      db.select({ id: driver.id, nationalId: driver.nationalId }).from(driver).where(isNotNull(driver.nationalId)),
    ]);
    return resolveInspectionLinks(value, vehicles, drivers);
  } catch (e) {
    console.error("inspection link lookup failed", e);
    return { vehicleId: null, trailerVehicleId: null, driverId: null };
  }
}

export async function insertInspection(value: ValidInspection) {
  const links = await resolveLinks(value);
  await db.insert(t).values({
    ...links,
    inspectionDate: value.date,
    inspectionTime: value.time,
    plate: value.plate,
    trailerPlate: value.trailerPlate,
    driverName: value.driverName,
    driverNationalId: value.driverNationalId,
    odometer: value.odometer,
    route: value.route,
    muleNotApplicable: value.muleNotApplicable,
    answers: value.answers,
    hasCriticalFailure: value.hasCriticalFailure,
    signature: value.signature,
  });
}

/** One page of inspections, newest first; `hasNext` tells whether another page follows. */
export async function listInspections(
  filters: InspectionFilters,
): Promise<{ rows: InspectionListRow[]; hasNext: boolean }> {
  const conditions: SQL[] = [];
  if (filters.plate) conditions.push(like(t.plate, `%${escapeLikePattern(filters.plate)}%`));
  if (filters.from) conditions.push(gte(t.inspectionDate, filters.from));
  if (filters.to) conditions.push(lte(t.inspectionDate, filters.to));
  if (filters.driverId) conditions.push(eq(t.driverId, filters.driverId));
  if (filters.vehicleId) conditions.push(or(eq(t.vehicleId, filters.vehicleId), eq(t.trailerVehicleId, filters.vehicleId))!);

  const rows = await db
    .select({
      id: t.id,
      inspectionDate: t.inspectionDate,
      inspectionTime: t.inspectionTime,
      plate: t.plate,
      driverName: t.driverName,
      route: t.route,
      hasCriticalFailure: t.hasCriticalFailure,
      vehicleId: t.vehicleId,
      vehiclePlate: vehicle.plate,
      driverId: t.driverId,
    })
    .from(t)
    .leftJoin(vehicle, eq(t.vehicleId, vehicle.id))
    .where(and(...conditions))
    .orderBy(desc(t.inspectionDate), desc(t.inspectionTime), desc(t.createdAt))
    .limit(INSPECTIONS_PAGE_SIZE + 1)
    .offset((filters.page - 1) * INSPECTIONS_PAGE_SIZE);

  return { rows: rows.slice(0, INSPECTIONS_PAGE_SIZE), hasNext: rows.length > INSPECTIONS_PAGE_SIZE };
}

export async function findInspection(id: string): Promise<InspectionDetail | null> {
  const trailer = alias(schema.vehicles, "trailer");
  const [row] = await db
    .select({
      id: t.id,
      createdAt: t.createdAt,
      inspectionDate: t.inspectionDate,
      inspectionTime: t.inspectionTime,
      plate: t.plate,
      trailerPlate: t.trailerPlate,
      driverName: t.driverName,
      driverNationalId: t.driverNationalId,
      odometer: t.odometer,
      route: t.route,
      muleNotApplicable: t.muleNotApplicable,
      answers: t.answers,
      hasCriticalFailure: t.hasCriticalFailure,
      signature: t.signature,
      vehicleId: t.vehicleId,
      vehiclePlate: vehicle.plate,
      trailerVehicleId: t.trailerVehicleId,
      trailerRegisteredPlate: trailer.plate,
      driverId: t.driverId,
      registeredDriverName: driver.name,
    })
    .from(t)
    .leftJoin(vehicle, eq(t.vehicleId, vehicle.id))
    .leftJoin(trailer, eq(t.trailerVehicleId, trailer.id))
    .leftJoin(driver, eq(t.driverId, driver.id))
    .where(eq(t.id, id))
    .limit(1);
  return row ?? null;
}

/** The latest inspections of one vehicle, as tractor or as trailer, newest first. */
export async function listVehicleInspections(vehicleId: number, limit: number): Promise<VehicleInspectionRow[]> {
  const rows = await db
    .select({
      id: t.id,
      inspectionDate: t.inspectionDate,
      inspectionTime: t.inspectionTime,
      driverName: t.driverName,
      hasCriticalFailure: t.hasCriticalFailure,
      vehicleId: t.vehicleId,
    })
    .from(t)
    .where(or(eq(t.vehicleId, vehicleId), eq(t.trailerVehicleId, vehicleId)))
    .orderBy(desc(t.inspectionDate), desc(t.inspectionTime), desc(t.createdAt))
    .limit(limit);
  return rows.map(({ vehicleId: tractorId, ...row }) => ({ ...row, asTrailer: tractorId !== vehicleId }));
}
