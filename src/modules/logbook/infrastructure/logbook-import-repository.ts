import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { vehicleCommandRepository } from "@/modules/vehicles/infrastructure/vehicle-command-repository";
import type { LogbookImportRepository } from "../application/logbook-import-ports";

/** Rows per INSERT: far below the driver's parameter limit even for the widest table. */
const CHUNK = 500;

function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

export const logbookImportRepository: LogbookImportRepository = {
  async findVehicle(plate) {
    const [vehicle] = await vehicleCommandRepository.findByPlates([plate]);
    if (!vehicle) return null;
    const { id, status } = vehicle;
    return { id, status };
  },

  async loadExisting(vehicleId) {
    const [services, [technical]] = await Promise.all([
      db
        .select({
          date: schema.vehicleServices.date,
          description: schema.vehicleServices.description,
          price: schema.vehicleServices.price,
        })
        .from(schema.vehicleServices)
        .where(eq(schema.vehicleServices.vehicleId, vehicleId)),
      db
        .select({
          registrationDate: schema.vehicles.registrationDate,
          modelYear: schema.vehicles.modelYear,
          engineNumber: schema.vehicles.engineNumber,
          chassisNumber: schema.vehicles.chassisNumber,
          serialNumber: schema.vehicles.serialNumber,
          bodyType: schema.vehicles.bodyType,
          fuelType: schema.vehicles.fuelType,
          capacity: schema.vehicles.capacity,
          engineDisplacement: schema.vehicles.engineDisplacement,
          grossWeightKg: schema.vehicles.grossWeightKg,
          color: schema.vehicles.color,
        })
        .from(schema.vehicles)
        .where(eq(schema.vehicles.id, vehicleId)),
    ]);
    return { services, technical };
  },

  async apply(vehicleId, write) {
    // One transaction: a failure anywhere leaves the logbook as it was.
    await db.transaction(async (tx) => {
      for (const rows of chunks(write.services)) {
        await tx.insert(schema.vehicleServices).values(rows.map((r) => ({ ...r, vehicleId })));
      }
      // COALESCE keeps a value saved by someone else since the plan was made: never overwritten.
      const fill = (Object.keys(write.technical) as Array<keyof typeof write.technical>).map(
        (key) => [key, sql`coalesce(${schema.vehicles[key]}, ${write.technical[key]})`] as const,
      );
      if (fill.length > 0) {
        await tx.update(schema.vehicles).set(Object.fromEntries(fill)).where(eq(schema.vehicles.id, vehicleId));
      }
    });
  },
};
