import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
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
      technical: {
        registrationDate: vehicle.registrationDate,
        modelYear: vehicle.modelYear,
        engineNumber: vehicle.engineNumber,
        chassisNumber: vehicle.chassisNumber,
        serialNumber: vehicle.serialNumber,
        bodyType: vehicle.bodyType,
        fuelType: vehicle.fuelType,
        capacity: vehicle.capacity,
        engineDisplacement: vehicle.engineDisplacement,
        grossWeightKg: vehicle.grossWeightKg,
        color: vehicle.color,
      },
      today,
    };
  });
}

/** Full history of one vehicle for the read-only detail page. */
export async function loadVehicleHistory(vehicleId: number) {
  const [ownerships, assignments, documents, sales] = await Promise.all([
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
    db.select().from(schema.sales).where(eq(schema.sales.vehicleId, vehicleId)),
  ]);
  return { ownerships, assignments, documents, sale: sales[0] ?? null };
}

/** Supplies of the vehicle's latest oil change: the starting point of the next one. */
export async function loadLastOilItems(vehicleId: number): Promise<OilItem[]> {
  const [last] = await db
    .select({ id: schema.oilChanges.id })
    .from(schema.oilChanges)
    .where(eq(schema.oilChanges.vehicleId, vehicleId))
    .orderBy(desc(schema.oilChanges.date), desc(schema.oilChanges.id))
    .limit(1);
  if (!last) return [];
  const items = await db
    .select({ quantity: schema.oilChangeItems.quantity, detail: schema.oilChangeItems.detail })
    .from(schema.oilChangeItems)
    .where(eq(schema.oilChangeItems.oilChangeId, last.id))
    .orderBy(asc(schema.oilChangeItems.id));
  return items;
}

/** Vehicle classes and the plates that can tow, for the create / edit forms. */
export async function loadVehicleFormLists() {
  const [classes, plates] = await Promise.all([
    db
      .select({ id: schema.vehicleClasses.id, name: schema.vehicleClasses.name })
      .from(schema.vehicleClasses)
      .orderBy(asc(schema.vehicleClasses.name)),
    db
      .select({ plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(ne(schema.vehicles.status, "SOLD"))
      .orderBy(asc(schema.vehicles.plate)),
  ]);
  return { classes, plates: plates.map((p) => p.plate) };
}

/** Current editable data of one vehicle (prefills the edit form). */
export async function loadVehicleEditValues(plate: string) {
  const towing = alias(schema.vehicles, "towing");
  const [row] = await db
    .select({
      plate: schema.vehicles.plate,
      classId: schema.vehicles.classId,
      brandLine: schema.vehicles.brandLine,
      notes: schema.vehicles.notes,
      municipality: schema.vehicles.municipality,
      serviceType: schema.vehicles.serviceType,
      oilMode: schema.vehicles.oilMode,
      towingPlate: towing.plate,
    })
    .from(schema.vehicles)
    .leftJoin(towing, eq(schema.vehicles.towingVehicleId, towing.id))
    .where(eq(schema.vehicles.plate, plate));
  return row ?? null;
}
