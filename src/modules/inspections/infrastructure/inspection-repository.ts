import { and, desc, eq, gte, isNull, like, lte, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { ClosureInput, ExitDecision, ExitDecisionInput } from "../domain/exit-decision";
import { escapeLikePattern, INSPECTIONS_PAGE_SIZE, type InspectionFilters } from "../domain/inspection-filters";
import { applySelectedDriver, resolveInspectionLinks, type InspectionLinks } from "../domain/inspection-links";
import { uncheckedCount, type InspectionAnswers, type ValidInspection } from "../domain/preoperational-inspection";

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
  /** Applicable checklist items nobody answered (only critical ones are required). */
  uncheckedCount: number;
  /** The maintenance chief's decision; null while pending. */
  exitDecision: ExitDecision | null;
};

/** Who decided / closed, and when; the names come from the user table (null if that user was deleted). */
export type InspectionExit = {
  authorizedTime: string | null;
  decidedAt: Date | null;
  decidedByName: string | null;
};

export type InspectionClosure = {
  date: string;
  workOrder: string;
  action: string;
  responsible: string;
  recordedAt: Date | null;
  recordedByName: string | null;
};

export type InspectionDetail = Omit<InspectionListRow, "uncheckedCount"> & {
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
  exit: InspectionExit | null;
  closure: InspectionClosure | null;
};

/** One row of a vehicle's own inspections; `asTrailer` tells it was pulled, not driven. */
export type VehicleInspectionRow = {
  id: string;
  inspectionDate: string;
  inspectionTime: string;
  driverName: string;
  hasCriticalFailure: boolean;
  exitDecision: ExitDecision | null;
  asTrailer: boolean;
};

/**
 * Matches the typed header against the registered vehicles and drivers. A failed lookup only means
 * no links: the submission is saved either way.
 */
async function resolveLinks(
  value: ValidInspection,
): Promise<{ links: InspectionLinks; identity: DriverIdentity }> {
  const typed = { driverName: value.driverName, driverNationalId: value.driverNationalId };
  try {
    const [vehicles, drivers] = await Promise.all([
      db.select({ id: vehicle.id, plate: vehicle.plate }).from(vehicle),
      db.select({ id: driver.id, name: driver.name, nationalId: driver.nationalId }).from(driver),
    ]);
    const applied = applySelectedDriver(value, drivers);
    // The registered national id replaces the typed one, so the link uses it too.
    const identity = applied.ok ? applied : null;
    return {
      links: resolveInspectionLinks(
        { ...value, driverNationalId: identity?.driverNationalId ?? value.driverNationalId },
        vehicles,
        drivers,
      ),
      identity: identity ?? { ok: false },
    };
  } catch (e) {
    console.error("inspection link lookup failed", e);
    return {
      links: { vehicleId: null, trailerVehicleId: null, driverId: null },
      identity: typed.driverNationalId ? { ok: true, ...typed } : { ok: false },
    };
  }
}

type DriverIdentity = { ok: true; driverName: string; driverNationalId: string } | { ok: false };

/** Saves the inspection; `missingNationalId` when a picked driver has no registered id and none was typed. */
export async function insertInspection(value: ValidInspection): Promise<{ ok: true } | { ok: false; missingNationalId: true }> {
  const { links, identity } = await resolveLinks(value);
  if (!identity.ok) return { ok: false, missingNationalId: true };
  await db.insert(t).values({
    ...links,
    inspectionDate: value.date,
    inspectionTime: value.time,
    plate: value.plate,
    trailerPlate: value.trailerPlate,
    driverName: identity.driverName,
    driverNationalId: identity.driverNationalId,
    odometer: value.odometer,
    route: value.route,
    muleNotApplicable: value.muleNotApplicable,
    answers: value.answers,
    hasCriticalFailure: value.hasCriticalFailure,
    signature: value.signature,
  });
  return { ok: true };
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
  if (filters.exit === "PENDING") conditions.push(isNull(t.exitDecision));
  else if (filters.exit !== "ALL") conditions.push(eq(t.exitDecision, filters.exit));

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
      exitDecision: t.exitDecision,
      // Needed only to count the unanswered items; not returned. The page is a handful of rows.
      answers: t.answers,
      muleNotApplicable: t.muleNotApplicable,
    })
    .from(t)
    .leftJoin(vehicle, eq(t.vehicleId, vehicle.id))
    .where(and(...conditions))
    .orderBy(desc(t.inspectionDate), desc(t.inspectionTime), desc(t.createdAt))
    .limit(INSPECTIONS_PAGE_SIZE + 1)
    .offset((filters.page - 1) * INSPECTIONS_PAGE_SIZE);

  return {
    rows: rows.slice(0, INSPECTIONS_PAGE_SIZE).map(({ answers, muleNotApplicable, ...row }) => ({
      ...row,
      uncheckedCount: uncheckedCount(answers, muleNotApplicable),
    })),
    hasNext: rows.length > INSPECTIONS_PAGE_SIZE,
  };
}

export async function findInspection(id: string): Promise<InspectionDetail | null> {
  const trailer = alias(schema.vehicles, "trailer");
  const decider = alias(schema.user, "decider");
  const recorder = alias(schema.user, "recorder");
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
      exitDecision: t.exitDecision,
      exitAuthorizedTime: t.exitAuthorizedTime,
      exitDecidedAt: t.exitDecidedAt,
      exitDecidedByName: decider.name,
      closureDate: t.closureDate,
      closureWorkOrder: t.closureWorkOrder,
      closureAction: t.closureAction,
      closureResponsible: t.closureResponsible,
      closureRecordedAt: t.closureRecordedAt,
      closureRecordedByName: recorder.name,
    })
    .from(t)
    .leftJoin(vehicle, eq(t.vehicleId, vehicle.id))
    .leftJoin(trailer, eq(t.trailerVehicleId, trailer.id))
    .leftJoin(driver, eq(t.driverId, driver.id))
    .leftJoin(decider, eq(t.exitDecidedBy, decider.id))
    .leftJoin(recorder, eq(t.closureRecordedBy, recorder.id))
    .where(eq(t.id, id))
    .limit(1);
  if (!row) return null;
  const {
    exitAuthorizedTime,
    exitDecidedAt,
    exitDecidedByName,
    closureDate,
    closureWorkOrder,
    closureAction,
    closureResponsible,
    closureRecordedAt,
    closureRecordedByName,
    ...rest
  } = row;
  return {
    ...rest,
    exit: row.exitDecision
      ? { authorizedTime: exitAuthorizedTime, decidedAt: exitDecidedAt, decidedByName: exitDecidedByName }
      : null,
    closure: closureDate
      ? {
          date: closureDate,
          workOrder: closureWorkOrder ?? "",
          action: closureAction ?? "",
          responsible: closureResponsible ?? "",
          recordedAt: closureRecordedAt,
          recordedByName: closureRecordedByName,
        }
      : null,
  };
}

/** What the admin actions need to validate: the date and the answers. */
export async function findInspectionForDecision(
  id: string,
): Promise<{ inspectionDate: string; answers: InspectionAnswers } | null> {
  const [row] = await db
    .select({ inspectionDate: t.inspectionDate, answers: t.answers })
    .from(t)
    .where(eq(t.id, id))
    .limit(1);
  return row ?? null;
}

/** Records (or overwrites) the exit decision; false when the inspection does not exist. */
export async function saveExitDecision(id: string, input: ExitDecisionInput, userId: string): Promise<boolean> {
  const updated = await db
    .update(t)
    .set({
      exitDecision: input.decision,
      exitAuthorizedTime: input.authorizedTime,
      exitDecidedAt: new Date(),
      exitDecidedBy: userId,
    })
    .where(eq(t.id, id))
    .returning({ id: t.id });
  return updated.length > 0;
}

/** Records (or overwrites) the novelty closure; false when the inspection does not exist. */
export async function saveClosure(id: string, input: ClosureInput, userId: string): Promise<boolean> {
  const updated = await db
    .update(t)
    .set({
      closureDate: input.date,
      closureWorkOrder: input.workOrder,
      closureAction: input.action,
      closureResponsible: input.responsible,
      closureRecordedAt: new Date(),
      closureRecordedBy: userId,
    })
    .where(eq(t.id, id))
    .returning({ id: t.id });
  return updated.length > 0;
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
      exitDecision: t.exitDecision,
      vehicleId: t.vehicleId,
    })
    .from(t)
    .where(or(eq(t.vehicleId, vehicleId), eq(t.trailerVehicleId, vehicleId)))
    .orderBy(desc(t.inspectionDate), desc(t.inspectionTime), desc(t.createdAt))
    .limit(limit);
  return rows.map(({ vehicleId: tractorId, ...row }) => ({ ...row, asTrailer: tractorId !== vehicleId }));
}
