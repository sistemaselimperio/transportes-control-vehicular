import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkDriverDeletion } from "../domain/driver-deletion";
import type { DriverRow } from "../domain/driver-row";

/** Every driver with the plates of their current (open) assignments. */
export async function loadDriverRows(): Promise<DriverRow[]> {
  const [drivers, assignments] = await Promise.all([
    db.select().from(schema.drivers),
    db
      .select({ driverId: schema.driverAssignments.driverId, plate: schema.vehicles.plate })
      .from(schema.driverAssignments)
      .innerJoin(schema.vehicles, eq(schema.driverAssignments.vehicleId, schema.vehicles.id))
      .where(isNull(schema.driverAssignments.toDate))
      .orderBy(asc(schema.vehicles.plate)),
  ]);

  const plates = new Map<number, string[]>();
  for (const a of assignments) {
    const list = plates.get(a.driverId) ?? [];
    list.push(a.plate);
    plates.set(a.driverId, list);
  }

  return drivers.map((d) => ({
    id: d.id,
    name: d.name,
    nationalId: d.nationalId,
    phone: d.phone,
    company: d.company,
    status: d.status,
    plates: plates.get(d.id) ?? [],
  }));
}

type DriverValues = Omit<DriverRow, "id" | "plates">;

/** Id of the driver holding that national ID, ignoring `exceptId`. */
export async function findDriverIdByNationalId(nationalId: string, exceptId?: number) {
  const rows = await db
    .select({ id: schema.drivers.id })
    .from(schema.drivers)
    .where(
      and(
        eq(schema.drivers.nationalId, nationalId),
        exceptId == null ? undefined : ne(schema.drivers.id, exceptId),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function insertDriver(values: DriverValues) {
  await db.insert(schema.drivers).values(values);
}

/** Returns false when no driver has that id. */
export async function updateDriver(id: number, values: DriverValues) {
  const rows = await db
    .update(schema.drivers)
    .set(values)
    .where(eq(schema.drivers.id, id))
    .returning({ id: schema.drivers.id });
  return rows.length === 1;
}

export type DeleteDriverResult =
  | { status: "deleted"; name: string }
  | { status: "not_found" }
  | { status: "assigned"; message: string };

/**
 * Deletes a driver and their closed assignments in one transaction. A driver with a current
 * (open, `toDate` null) assignment is refused and nothing is touched.
 */
export async function deleteDriver(id: number): Promise<DeleteDriverResult> {
  return db.transaction(async (tx) => {
    const [driver] = await tx
      .select({ name: schema.drivers.name })
      .from(schema.drivers)
      .where(eq(schema.drivers.id, id))
      .limit(1);
    if (!driver) return { status: "not_found" };

    const current = await tx
      .select({ plate: schema.vehicles.plate })
      .from(schema.driverAssignments)
      .innerJoin(schema.vehicles, eq(schema.driverAssignments.vehicleId, schema.vehicles.id))
      .where(and(eq(schema.driverAssignments.driverId, id), isNull(schema.driverAssignments.toDate)))
      .orderBy(asc(schema.vehicles.plate));
    const check = checkDriverDeletion(
      driver.name,
      current.map((a) => a.plate),
    );
    if (!check.ok) return { status: "assigned", message: check.message };

    await tx.delete(schema.driverAssignments).where(eq(schema.driverAssignments.driverId, id));
    await tx.delete(schema.drivers).where(eq(schema.drivers.id, id));
    return { status: "deleted", name: driver.name };
  });
}
