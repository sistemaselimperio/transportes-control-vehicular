import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { TripPorts, TripValues } from "../application/trip-commands";
import type { TripRow } from "../domain/trip-row";

/** Every trip, newest start first. */
export async function loadTripRows(): Promise<TripRow[]> {
  const rows = await db.select().from(schema.trips).orderBy(desc(schema.trips.startAt), desc(schema.trips.id));
  return rows.map(toTripRow);
}

/** The latest `limit` trips of one vehicle, newest start first. */
export async function loadVehicleTrips(vehicleId: number, limit: number): Promise<TripRow[]> {
  const rows = await db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.vehicleId, vehicleId))
    .orderBy(desc(schema.trips.startAt), desc(schema.trips.id))
    .limit(limit);
  return rows.map(toTripRow);
}

function toTripRow(r: typeof schema.trips.$inferSelect): TripRow {
  return {
    id: r.id,
    startAt: r.startAt.toISOString(),
    origin: r.origin,
    destination: r.destination,
    plate: r.plate,
    vehicleId: r.vehicleId,
    area: r.area,
    status: r.status,
  };
}

const toColumns = (v: TripValues) => ({
  startAt: v.startAt,
  origin: v.origin,
  destination: v.destination,
  plate: v.plate,
  vehicleId: v.vehicleId,
  area: v.area,
  status: v.status,
});

export const tripRepository: TripPorts = {
  async findVehicleByPlate(plate) {
    // A sold vehicle left the fleet: it cannot be picked for a trip.
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(and(eq(schema.vehicles.plate, plate), ne(schema.vehicles.status, "SOLD")))
      .limit(1);
    return vehicle ?? null;
  },

  async findTrip(id) {
    const [trip] = await db
      .select({
        id: schema.trips.id,
        plate: schema.trips.plate,
        vehicleId: schema.trips.vehicleId,
        status: schema.trips.status,
      })
      .from(schema.trips)
      .where(eq(schema.trips.id, id))
      .limit(1);
    return trip ?? null;
  },

  async insertTrip(values) {
    await db.insert(schema.trips).values(toColumns(values));
  },

  async updateTrip(id, expectedStatus, values) {
    const rows = await db
      .update(schema.trips)
      .set({ ...toColumns(values), updatedAt: new Date() })
      .where(and(eq(schema.trips.id, id), eq(schema.trips.status, expectedStatus)))
      .returning({ id: schema.trips.id });
    return rows.length === 1;
  },

  async deleteTrip(id) {
    const rows = await db.delete(schema.trips).where(eq(schema.trips.id, id)).returning({ id: schema.trips.id });
    return rows.length === 1;
  },
};
