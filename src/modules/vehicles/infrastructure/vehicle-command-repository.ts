import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { driverKey, stripAccents } from "@/modules/import-export/domain/cell-parsers";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import type {
  DriverTarget,
  OwnerTarget,
  PeriodClose,
  VehicleCommandRepository,
  VehicleSnapshot,
} from "../application/vehicle-ports";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

const nameKey = (name: string) => stripAccents(name).toUpperCase().replace(/\s+/g, " ").trim();

/** Finds the owner for a target; creates it when `create` is set. */
async function resolveOwnerId(
  ex: Executor,
  target: OwnerTarget,
  create: boolean,
): Promise<number | null> {
  if (target.kind === "existing") return target.id;

  if (target.kind === "imperio") {
    const known = KNOWN_OWNERS.IMPERIO;
    const [found] = await ex
      .select({ id: schema.owners.id })
      .from(schema.owners)
      .where(eq(schema.owners.documentNumber, known.documentNumber));
    if (found) return found.id;
    if (!create) return null;
    const [row] = await ex.insert(schema.owners).values({ ...known }).returning({ id: schema.owners.id });
    return row.id;
  }

  const all = await ex.select().from(schema.owners);
  const same = all.find(
    (o) =>
      (target.documentNumber && o.documentNumber === target.documentNumber) ||
      nameKey(o.name) === nameKey(target.name),
  );
  if (same) return same.id;
  if (!create) return null;
  const [row] = await ex
    .insert(schema.owners)
    .values({ name: target.name, documentNumber: target.documentNumber, group: "THIRD_PARTY" })
    .returning({ id: schema.owners.id });
  return row.id;
}

/** Finds the driver for a target (by id, cédula, or normalized name); creates it when `create` is set. */
async function resolveDriverId(
  ex: Executor,
  target: DriverTarget,
  create: boolean,
): Promise<number | null> {
  if (target.kind === "existing") return target.id;

  const all = await ex.select().from(schema.drivers);
  const same = all.find((d) =>
    target.nationalId ? d.nationalId === target.nationalId : driverKey(d.name) === driverKey(target.name),
  );
  if (same) {
    if (create && target.phone && !same.phone) {
      // Fill a missing phone, never overwrite an existing one.
      await ex.update(schema.drivers).set({ phone: target.phone }).where(eq(schema.drivers.id, same.id));
    }
    return same.id;
  }
  if (!create) return null;
  const [row] = await ex
    .insert(schema.drivers)
    .values({ name: target.name, nationalId: target.nationalId, phone: target.phone })
    .returning({ id: schema.drivers.id });
  return row.id;
}

async function closeOwnership(tx: Tx, close: PeriodClose | null) {
  if (!close) return;
  await tx
    .update(schema.ownerships)
    .set({ fromDate: close.fromDate, toDate: close.toDate })
    .where(eq(schema.ownerships.id, close.id));
}

async function closeAssignment(tx: Tx, close: PeriodClose | null) {
  if (!close) return;
  await tx
    .update(schema.driverAssignments)
    .set({ fromDate: close.fromDate, toDate: close.toDate })
    .where(eq(schema.driverAssignments.id, close.id));
}

async function insertOilItems(tx: Tx, oilChangeId: number, items: OilItem[]) {
  if (items.length === 0) return;
  await tx.insert(schema.oilChangeItems).values(items.map((item) => ({ oilChangeId, ...item })));
}

async function raiseKm(tx: Tx, vehicleId: number, newCurrentKm: number | null, at: string) {
  if (newCurrentKm == null) return;
  await tx
    .update(schema.vehicles)
    .set({ currentKm: newCurrentKm, currentKmAt: at })
    .where(eq(schema.vehicles.id, vehicleId));
}

export const vehicleCommandRepository: VehicleCommandRepository = {
  async findByPlates(plates) {
    if (plates.length === 0) return [];
    const rows = await db
      .select({ vehicle: schema.vehicles, cls: schema.vehicleClasses })
      .from(schema.vehicles)
      .innerJoin(schema.vehicleClasses, eq(schema.vehicles.classId, schema.vehicleClasses.id))
      .where(inArray(schema.vehicles.plate, plates));
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.vehicle.id);

    const [ownerships, assignments, oils] = await Promise.all([
      db
        .select()
        .from(schema.ownerships)
        .where(and(inArray(schema.ownerships.vehicleId, ids), isNull(schema.ownerships.toDate)))
        .orderBy(asc(schema.ownerships.id)),
      db
        .select()
        .from(schema.driverAssignments)
        .where(
          and(inArray(schema.driverAssignments.vehicleId, ids), isNull(schema.driverAssignments.toDate)),
        )
        .orderBy(asc(schema.driverAssignments.id)),
      db
        .select()
        .from(schema.oilChanges)
        .where(inArray(schema.oilChanges.vehicleId, ids))
        .orderBy(asc(schema.oilChanges.date), asc(schema.oilChanges.id)),
    ]);

    // Rows arrive ascending: the last one per vehicle is the current one.
    const lastBy = <T extends { vehicleId: number }>(list: T[]) => {
      const out = new Map<number, T>();
      for (const r of list) out.set(r.vehicleId, r);
      return out;
    };
    const currentOwnership = lastBy(ownerships);
    const currentAssignment = lastBy(assignments);
    const lastOil = lastBy(oils);

    return rows.map(({ vehicle, cls }): VehicleSnapshot => {
      const own = currentOwnership.get(vehicle.id);
      const asg = currentAssignment.get(vehicle.id);
      const oil = lastOil.get(vehicle.id);
      return {
        id: vehicle.id,
        plate: vehicle.plate,
        status: vehicle.status,
        odometerWorking: vehicle.odometerWorking,
        currentKm: vehicle.currentKm,
        oilMode: vehicle.oilMode,
        oilInterval: {
          months: oil?.intervalMonths ?? cls.oilIntervalMonths,
          km: oil?.intervalKm ?? cls.oilIntervalKm,
        },
        ownership: own ? { id: own.id, ownerId: own.ownerId, fromDate: own.fromDate } : null,
        assignment: asg ? { id: asg.id, driverId: asg.driverId, fromDate: asg.fromDate } : null,
      };
    });
  },

  findOwnerId: (target) => resolveOwnerId(db, target, false),
  findDriverId: (target) => resolveDriverId(db, target, false),

  async findClass(id) {
    const [cls] = await db
      .select({
        id: schema.vehicleClasses.id,
        oilIntervalMonths: schema.vehicleClasses.oilIntervalMonths,
        oilIntervalKm: schema.vehicleClasses.oilIntervalKm,
      })
      .from(schema.vehicleClasses)
      .where(eq(schema.vehicleClasses.id, id));
    return cls ?? null;
  },

  async createVehicle({ vehicle, owner, driver, documents, tax, oilChange }) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.vehicles)
        .values(vehicle)
        .returning({ id: schema.vehicles.id });
      const vehicleId = row.id;

      if (owner) {
        const ownerId = (await resolveOwnerId(tx, owner.target, true))!;
        await tx.insert(schema.ownerships).values({ vehicleId, ownerId, fromDate: owner.fromDate });
      }
      if (driver) {
        const driverId = (await resolveDriverId(tx, driver.target, true))!;
        await tx
          .insert(schema.driverAssignments)
          .values({ vehicleId, driverId, fromDate: driver.fromDate });
      }
      if (documents.length > 0) {
        await tx.insert(schema.vehicleDocuments).values(documents.map((d) => ({ vehicleId, ...d })));
      }
      if (tax) await tx.insert(schema.vehicleTaxes).values({ vehicleId, ...tax });
      if (oilChange) await tx.insert(schema.oilChanges).values({ vehicleId, ...oilChange });
      return vehicleId;
    });
  },

  async updateVehicle(vehicleId, fields) {
    await db.update(schema.vehicles).set(fields).where(eq(schema.vehicles.id, vehicleId));
  },

  async addDocument(vehicleId, doc) {
    await db.insert(schema.vehicleDocuments).values({ vehicleId, ...doc });
  },

  async addTax(vehicleId, tax) {
    await db.insert(schema.vehicleTaxes).values({ vehicleId, ...tax });
  },

  async addOilChange(vehicleId, oil, newCurrentKm, items) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.oilChanges)
        .values({ vehicleId, ...oil })
        .returning({ id: schema.oilChanges.id });
      await insertOilItems(tx, row.id, items);
      await raiseKm(tx, vehicleId, newCurrentKm, oil.date);
    });
  },
  async findOilChangeVehicle(oilChangeId) {
    const [row] = await db
      .select({ plate: schema.vehicles.plate })
      .from(schema.oilChanges)
      .innerJoin(schema.vehicles, eq(schema.oilChanges.vehicleId, schema.vehicles.id))
      .where(eq(schema.oilChanges.id, oilChangeId));
    if (!row) return null;
    const [vehicle] = await vehicleCommandRepository.findByPlates([row.plate]);
    return vehicle ?? null;
  },
  async updateOilChange(oilChangeId, vehicleId, oil, newCurrentKm, items) {
    await db.transaction(async (tx) => {
      await tx.update(schema.oilChanges).set(oil).where(eq(schema.oilChanges.id, oilChangeId));
      await tx.delete(schema.oilChangeItems).where(eq(schema.oilChangeItems.oilChangeId, oilChangeId));
      await insertOilItems(tx, oilChangeId, items);
      await raiseKm(tx, vehicleId, newCurrentKm, oil.date);
    });
  },
  async deleteOilChange(oilChangeId) {
    // The supplies go with it (ON DELETE CASCADE).
    await db.delete(schema.oilChanges).where(eq(schema.oilChanges.id, oilChangeId));
  },
  async updateOdometer(vehicleId, { odometerWorking, reading }) {
    await db
      .update(schema.vehicles)
      .set({
        odometerWorking,
        ...(reading ? { currentKm: reading.km, currentKmAt: reading.at } : {}),
      })
      .where(eq(schema.vehicles.id, vehicleId));
  },

  async setStatus(vehicleId, status) {
    await db.update(schema.vehicles).set({ status }).where(eq(schema.vehicles.id, vehicleId));
  },

  async assignDriver({ vehicleId, driver, date, close }) {
    await db.transaction(async (tx) => {
      const driverId = (await resolveDriverId(tx, driver, true))!;
      await closeAssignment(tx, close);
      await tx.insert(schema.driverAssignments).values({ vehicleId, driverId, fromDate: date });
    });
  },

  async transferOwnership({ vehicleId, owner, date, close }) {
    await db.transaction(async (tx) => {
      const ownerId = (await resolveOwnerId(tx, owner, true))!;
      await closeOwnership(tx, close);
      await tx.insert(schema.ownerships).values({ vehicleId, ownerId, fromDate: date });
    });
  },

  async registerSale({ vehicleId, sale, closeOwnership: ownClose, closeAssignment: asgClose }) {
    await db.transaction(async (tx) => {
      await tx.insert(schema.sales).values({ vehicleId, ...sale });
      await tx.update(schema.vehicles).set({ status: "SOLD" }).where(eq(schema.vehicles.id, vehicleId));
      await closeOwnership(tx, ownClose);
      await closeAssignment(tx, asgClose);
    });
  },
};

/** Owners and drivers for the action pickers. */
export async function loadPeople() {
  const [owners, drivers] = await Promise.all([
    db.select().from(schema.owners).orderBy(asc(schema.owners.name)),
    db.select().from(schema.drivers).orderBy(asc(schema.drivers.name)),
  ]);
  const imperio = owners.find((o) => o.documentNumber === KNOWN_OWNERS.IMPERIO.documentNumber);
  return {
    owners: owners.map((o) => ({ id: o.id, name: o.name })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.name, nationalId: d.nationalId })),
    imperioOwnerId: imperio?.id ?? null,
  };
}
