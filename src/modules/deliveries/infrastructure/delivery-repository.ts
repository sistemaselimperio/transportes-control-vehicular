import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DeliveryPorts, DeliveryValues } from "../application/delivery-commands";
import type { ClientLastDelivery, DeliveryRow } from "../domain/delivery-rules";

/** Every delivery with its client, newest day first. */
export async function loadDeliveryRows(): Promise<DeliveryRow[]> {
  const rows = await db
    .select({
      id: schema.deliveries.id,
      date: schema.deliveries.date,
      shift: schema.deliveries.shift,
      priority: schema.deliveries.priority,
      clientId: schema.deliveries.clientId,
      clientName: schema.clients.name,
      clientNit: schema.clients.nit,
      locationId: schema.deliveries.locationId,
      locationName: schema.clientLocations.name,
      destination: schema.deliveries.destination,
      quantity: schema.deliveries.quantity,
      weightKg: schema.deliveries.weightKg,
      status: schema.deliveries.status,
      plate: schema.deliveries.plate,
      vehicleId: schema.deliveries.vehicleId,
      notes: schema.deliveries.notes,
    })
    .from(schema.deliveries)
    .innerJoin(schema.clients, eq(schema.deliveries.clientId, schema.clients.id))
    .leftJoin(schema.clientLocations, eq(schema.deliveries.locationId, schema.clientLocations.id))
    .orderBy(desc(schema.deliveries.date), asc(schema.deliveries.id));
  return rows;
}

/** Every client with the date of its latest delivery (null when it has none). */
export async function loadClientsLastDelivery(): Promise<ClientLastDelivery[]> {
  return db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      nit: schema.clients.nit,
      lastDeliveryDate: sql<string | null>`max(${schema.deliveries.date})`,
    })
    .from(schema.clients)
    .leftJoin(schema.deliveries, eq(schema.deliveries.clientId, schema.clients.id))
    .groupBy(schema.clients.id);
}

const toColumns = (v: DeliveryValues) => ({
  date: v.date,
  shift: v.shift,
  priority: v.priority,
  clientId: v.clientId,
  locationId: v.locationId,
  destination: v.destination,
  quantity: v.quantity,
  weightKg: v.weightKg,
  plate: v.plate,
  vehicleId: v.vehicleId,
  notes: v.notes,
});

export const deliveryRepository: DeliveryPorts = {
  async clientExists(id) {
    const [row] = await db.select({ id: schema.clients.id }).from(schema.clients).where(eq(schema.clients.id, id)).limit(1);
    return row !== undefined;
  },

  async locationBelongsToClient(locationId, clientId) {
    const [row] = await db
      .select({ id: schema.clientLocations.id })
      .from(schema.clientLocations)
      .where(and(eq(schema.clientLocations.id, locationId), eq(schema.clientLocations.clientId, clientId)))
      .limit(1);
    return row !== undefined;
  },

  async findVehicleByPlate(plate) {
    // A sold vehicle left the fleet: it cannot be picked.
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(and(eq(schema.vehicles.plate, plate), ne(schema.vehicles.status, "SOLD")))
      .limit(1);
    return vehicle ?? null;
  },

  async findDelivery(id) {
    const [row] = await db
      .select({ plate: schema.deliveries.plate, vehicleId: schema.deliveries.vehicleId })
      .from(schema.deliveries)
      .where(eq(schema.deliveries.id, id))
      .limit(1);
    return row ?? null;
  },

  async insertDelivery(values) {
    await db.insert(schema.deliveries).values(toColumns(values));
  },

  async updateDelivery(id, values) {
    const rows = await db
      .update(schema.deliveries)
      .set({ ...toColumns(values), updatedAt: new Date() })
      .where(eq(schema.deliveries.id, id))
      .returning({ id: schema.deliveries.id });
    return rows.length === 1;
  },

  async setStatus(id, status) {
    const rows = await db
      .update(schema.deliveries)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.deliveries.id, id))
      .returning({ id: schema.deliveries.id });
    return rows.length === 1;
  },

  async deleteDelivery(id) {
    const rows = await db
      .delete(schema.deliveries)
      .where(eq(schema.deliveries.id, id))
      .returning({ id: schema.deliveries.id });
    return rows.length === 1;
  },
};
