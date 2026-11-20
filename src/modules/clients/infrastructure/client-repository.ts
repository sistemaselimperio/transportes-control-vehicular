import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ClientPorts, LocationPorts } from "../application/client-commands";
import type { ClientInput, LocationInput } from "../application/client-schemas";
import type { ClientLocationRow } from "../domain/client-location";
import type { ClientRow } from "../domain/client-row";
import { expandMapsLink } from "./maps-link-expander";

/** Every client with its fincas and how many deliveries it has, by name. */
export async function loadClientRows(): Promise<ClientRow[]> {
  const [clients, locations] = await Promise.all([
    db
      .select({
        id: schema.clients.id,
        name: schema.clients.name,
        nit: schema.clients.nit,
        phone: schema.clients.phone,
        notes: schema.clients.notes,
        deliveryCount: count(schema.deliveries.id),
      })
      .from(schema.clients)
      .leftJoin(schema.deliveries, eq(schema.deliveries.clientId, schema.clients.id))
      .groupBy(schema.clients.id)
      .orderBy(asc(sql`lower(${schema.clients.name})`), asc(schema.clients.id)),
    db
      .select({
        id: schema.clientLocations.id,
        clientId: schema.clientLocations.clientId,
        name: schema.clientLocations.name,
        address: schema.clientLocations.address,
        mapsUrl: schema.clientLocations.mapsUrl,
        latitude: schema.clientLocations.latitude,
        longitude: schema.clientLocations.longitude,
      })
      .from(schema.clientLocations)
      .orderBy(asc(sql`lower(${schema.clientLocations.name})`), asc(schema.clientLocations.id)),
  ]);

  const byClient = new Map<number, ClientLocationRow[]>();
  for (const location of locations) {
    const list = byClient.get(location.clientId);
    if (list) list.push(location);
    else byClient.set(location.clientId, [location]);
  }
  return clients.map((client) => ({ ...client, locations: byClient.get(client.id) ?? [] }));
}

const toColumns = (v: ClientInput) => ({
  name: v.name,
  nameKey: v.nameKey,
  nit: v.nit,
  phone: v.phone,
  notes: v.notes,
});

export const clientRepository: ClientPorts = {
  async findClientIdByNit(nit, exceptId) {
    const [row] = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(and(eq(schema.clients.nit, nit), exceptId == null ? undefined : ne(schema.clients.id, exceptId)))
      .limit(1);
    return row?.id ?? null;
  },

  async findClientIdByNameKey(nameKey, exceptId) {
    const [row] = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(and(eq(schema.clients.nameKey, nameKey), exceptId == null ? undefined : ne(schema.clients.id, exceptId)))
      .limit(1);
    return row?.id ?? null;
  },

  async insertClient(values) {
    await db.insert(schema.clients).values(toColumns(values));
  },

  async updateClient(id, values) {
    const rows = await db
      .update(schema.clients)
      .set({ ...toColumns(values), updatedAt: new Date() })
      .where(eq(schema.clients.id, id))
      .returning({ id: schema.clients.id });
    return rows.length === 1;
  },

  async countDeliveries(clientId) {
    const [row] = await db
      .select({ value: count() })
      .from(schema.deliveries)
      .where(eq(schema.deliveries.clientId, clientId));
    return row?.value ?? 0;
  },

  async deleteClient(id) {
    const rows = await db.delete(schema.clients).where(eq(schema.clients.id, id)).returning({ id: schema.clients.id });
    return rows.length === 1;
  },
};

const toLocationColumns = (v: LocationInput) => ({
  name: v.name,
  nameKey: v.nameKey,
  address: v.address,
  mapsUrl: v.mapsUrl,
  latitude: v.latitude,
  longitude: v.longitude,
});

export const locationRepository: LocationPorts = {
  async clientExists(id) {
    const [row] = await db.select({ id: schema.clients.id }).from(schema.clients).where(eq(schema.clients.id, id)).limit(1);
    return row !== undefined;
  },

  async findLocationClientId(id) {
    const [row] = await db
      .select({ clientId: schema.clientLocations.clientId })
      .from(schema.clientLocations)
      .where(eq(schema.clientLocations.id, id))
      .limit(1);
    return row?.clientId ?? null;
  },

  async findLocationIdByNameKey(clientId, nameKey, exceptId) {
    const [row] = await db
      .select({ id: schema.clientLocations.id })
      .from(schema.clientLocations)
      .where(
        and(
          eq(schema.clientLocations.clientId, clientId),
          eq(schema.clientLocations.nameKey, nameKey),
          exceptId == null ? undefined : ne(schema.clientLocations.id, exceptId),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  },

  async insertLocation(clientId, values) {
    await db.insert(schema.clientLocations).values({ clientId, ...toLocationColumns(values) });
  },

  async updateLocation(id, values) {
    const rows = await db
      .update(schema.clientLocations)
      .set({ ...toLocationColumns(values), updatedAt: new Date() })
      .where(eq(schema.clientLocations.id, id))
      .returning({ id: schema.clientLocations.id });
    return rows.length === 1;
  },

  async deleteLocation(id) {
    const rows = await db
      .delete(schema.clientLocations)
      .where(eq(schema.clientLocations.id, id))
      .returning({ id: schema.clientLocations.id });
    return rows.length === 1;
  },

  expandMapsLink,
};
