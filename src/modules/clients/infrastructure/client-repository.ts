import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ClientPorts } from "../application/client-commands";
import type { ClientInput } from "../application/client-schemas";
import type { ClientRow } from "../domain/client-row";

/** Every client with how many deliveries it has, by name. */
export async function loadClientRows(): Promise<ClientRow[]> {
  const rows = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      nit: schema.clients.nit,
      phone: schema.clients.phone,
      address: schema.clients.address,
      mapsUrl: schema.clients.mapsUrl,
      latitude: schema.clients.latitude,
      longitude: schema.clients.longitude,
      notes: schema.clients.notes,
      deliveryCount: count(schema.deliveries.id),
    })
    .from(schema.clients)
    .leftJoin(schema.deliveries, eq(schema.deliveries.clientId, schema.clients.id))
    .groupBy(schema.clients.id)
    .orderBy(asc(sql`lower(${schema.clients.name})`), asc(schema.clients.id));
  return rows;
}

const toColumns = (v: ClientInput) => ({
  name: v.name,
  nit: v.nit,
  phone: v.phone,
  address: v.address,
  mapsUrl: v.mapsUrl,
  latitude: v.latitude,
  longitude: v.longitude,
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
