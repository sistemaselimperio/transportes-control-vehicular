import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { DocumentData, VehicleRowInput } from "../domain/vehicle-row";

type DocType = "SOAT" | "TECNO" | "POLICY";

function latestBy<T extends { id: number }, K>(rows: T[], key: (r: T) => K): Map<K, T> {
  const out = new Map<K, T>();
  // rows arrive ascending by id: later rows overwrite earlier ones.
  for (const r of rows) out.set(key(r), r);
  return out;
}

/** Loads every vehicle (or one by plate) with its current data, ready for `buildVehicleRow`. */
export async function loadVehicleRowInputs(
  today: IsoDate,
  plate?: string,
): Promise<VehicleRowInput[]> {
  const vehicleRows = await db
    .select({ vehicle: schema.vehicles, cls: schema.vehicleClasses })
    .from(schema.vehicles)
    .innerJoin(
      schema.vehicleClasses,
      eq(schema.vehicles.classId, schema.vehicleClasses.id),
    )
    .where(plate ? eq(schema.vehicles.plate, plate) : undefined)
    .orderBy(asc(schema.vehicles.plate));
  if (vehicleRows.length === 0) return [];

  const ids = vehicleRows.map((r) => r.vehicle.id);
  const scope = (col: PgColumn) => (plate ? inArray(col, ids) : undefined);

  const [ownerships, assignments, documents, taxes, oilChanges] = await Promise.all([
    db
      .select({ vehicleId: schema.ownerships.vehicleId, id: schema.ownerships.id, owner: schema.owners })
      .from(schema.ownerships)
      .innerJoin(schema.owners, eq(schema.ownerships.ownerId, schema.owners.id))
      .where(and(scope(schema.ownerships.vehicleId), isNull(schema.ownerships.toDate)))
      .orderBy(asc(schema.ownerships.id)),
    db
      .select({ vehicleId: schema.driverAssignments.vehicleId, id: schema.driverAssignments.id, driver: schema.drivers })
      .from(schema.driverAssignments)
      .innerJoin(schema.drivers, eq(schema.driverAssignments.driverId, schema.drivers.id))
      .where(
        and(scope(schema.driverAssignments.vehicleId), isNull(schema.driverAssignments.toDate)),
      )
      .orderBy(asc(schema.driverAssignments.id)),
    db
      .select()
      .from(schema.vehicleDocuments)
      .where(scope(schema.vehicleDocuments.vehicleId))
      .orderBy(asc(schema.vehicleDocuments.id)),
    db
      .select()
      .from(schema.vehicleTaxes)
      .where(scope(schema.vehicleTaxes.vehicleId))
      .orderBy(asc(schema.vehicleTaxes.id)),
    db
      .select()
      .from(schema.oilChanges)
      .where(scope(schema.oilChanges.vehicleId))
      .orderBy(asc(schema.oilChanges.date), asc(schema.oilChanges.id)),
  ]);

  const currentOwner = latestBy(ownerships, (o) => o.vehicleId);
  const currentDriver = latestBy(assignments, (a) => a.vehicleId);
  const latestDoc = latestBy(documents, (d) => `${d.vehicleId}:${d.type}`);
  const latestTax = latestBy(taxes, (t) => t.vehicleId);
  const latestOil = latestBy(oilChanges, (o) => o.vehicleId);

  const doc = (vehicleId: number, type: DocType): DocumentData | null => {
    const d = latestDoc.get(`${vehicleId}:${type}`);
    return d
      ? { kind: d.policyKind, expiresOn: d.expiresOn, notApplicable: d.notApplicable }
      : null;
  };

  return vehicleRows.map(({ vehicle, cls }) => {
    const owner = currentOwner.get(vehicle.id)?.owner;
    const driver = currentDriver.get(vehicle.id)?.driver;
    const tax = latestTax.get(vehicle.id);
    const oil = latestOil.get(vehicle.id);
    return {
      vehicle: {
        id: vehicle.id,
        plate: vehicle.plate,
        status: vehicle.status,
        odometerWorking: vehicle.odometerWorking,
        currentKm: vehicle.currentKm,
        brandLine: vehicle.brandLine,
        municipality: vehicle.municipality,
        serviceType: vehicle.serviceType,
        notes: vehicle.notes,
        oilMode: vehicle.oilMode,
      },
      classInfo: {
        name: cls.name,
        oilIntervalKm: cls.oilIntervalKm,
        oilIntervalMonths: cls.oilIntervalMonths,
        documentsDefaultNotApplicable: cls.documentsDefaultNotApplicable,
      },
      owner: owner ? { name: owner.name, group: owner.group } : null,
      driver: driver ? { name: driver.name, phone: driver.phone } : null,
      policy: doc(vehicle.id, "POLICY"),
      soat: doc(vehicle.id, "SOAT"),
      tecno: doc(vehicle.id, "TECNO"),
      tax: tax ? { kind: tax.kind, year: tax.year } : null,
      lastOil: oil
        ? {
            date: oil.date,
            km: oil.km,
            nextKm: oil.nextKm,
            nextDate: oil.nextDate,
            intervalKm: oil.intervalKm,
            intervalMonths: oil.intervalMonths,
          }
        : null,
      today,
    };
  });
}

/** Full history of one vehicle for the read-only detail page. */
export async function loadVehicleHistory(vehicleId: number) {
  const [ownerships, assignments, documents, oilChanges, sales] = await Promise.all([
    db
      .select({
        fromDate: schema.ownerships.fromDate,
        toDate: schema.ownerships.toDate,
        ownerName: schema.owners.name,
      })
      .from(schema.ownerships)
      .innerJoin(schema.owners, eq(schema.ownerships.ownerId, schema.owners.id))
      .where(eq(schema.ownerships.vehicleId, vehicleId))
      .orderBy(desc(schema.ownerships.id)),
    db
      .select({
        fromDate: schema.driverAssignments.fromDate,
        toDate: schema.driverAssignments.toDate,
        driverName: schema.drivers.name,
        phone: schema.drivers.phone,
      })
      .from(schema.driverAssignments)
      .innerJoin(schema.drivers, eq(schema.driverAssignments.driverId, schema.drivers.id))
      .where(eq(schema.driverAssignments.vehicleId, vehicleId))
      .orderBy(desc(schema.driverAssignments.id)),
    db
      .select()
      .from(schema.vehicleDocuments)
      .where(eq(schema.vehicleDocuments.vehicleId, vehicleId))
      .orderBy(desc(schema.vehicleDocuments.id)),
    db
      .select()
      .from(schema.oilChanges)
      .where(eq(schema.oilChanges.vehicleId, vehicleId))
      .orderBy(desc(schema.oilChanges.date), desc(schema.oilChanges.id)),
    db.select().from(schema.sales).where(eq(schema.sales.vehicleId, vehicleId)),
  ]);
  return { ownerships, assignments, documents, oilChanges, sale: sales[0] ?? null };
}
