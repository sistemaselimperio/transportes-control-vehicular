import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LoadPorts, LoadValues } from "../application/load-commands";
import type { LoadRow } from "../domain/load-rules";

/** Every load, newest day first. */
export async function loadLoadRows(): Promise<LoadRow[]> {
  const rows = await db.select().from(schema.loads).orderBy(desc(schema.loads.date), desc(schema.loads.id));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    supplier: r.supplier,
    plate: r.plate,
    vehicleId: r.vehicleId,
    tons: r.tons,
    cost: r.cost,
    siesaNumber: r.siesaNumber,
    orderNumber: r.orderNumber,
    notes: r.notes,
  }));
}

const toColumns = (v: LoadValues) => ({
  date: v.date,
  supplier: v.supplier,
  plate: v.plate,
  vehicleId: v.vehicleId,
  tons: v.tons,
  cost: v.cost,
  siesaNumber: v.siesaNumber,
  orderNumber: v.orderNumber,
  notes: v.notes,
});

export const loadRepository: LoadPorts = {
  async findVehicleByPlate(plate) {
    // A sold vehicle left the fleet: it cannot be picked. No fleet permission is involved: this is
    // a server-side lookup for the commercial role.
    const [vehicle] = await db
      .select({ id: schema.vehicles.id, plate: schema.vehicles.plate })
      .from(schema.vehicles)
      .where(and(eq(schema.vehicles.plate, plate), ne(schema.vehicles.status, "SOLD")))
      .limit(1);
    return vehicle ?? null;
  },

  async findLoad(id) {
    const [row] = await db
      .select({ plate: schema.loads.plate, vehicleId: schema.loads.vehicleId })
      .from(schema.loads)
      .where(eq(schema.loads.id, id))
      .limit(1);
    return row ?? null;
  },

  async findLoadIdBySiesa(siesaNumber, exceptId) {
    const [row] = await db
      .select({ id: schema.loads.id })
      .from(schema.loads)
      .where(and(eq(schema.loads.siesaNumber, siesaNumber), exceptId == null ? undefined : ne(schema.loads.id, exceptId)))
      .limit(1);
    return row?.id ?? null;
  },

  async insertLoad(values) {
    await db.insert(schema.loads).values(toColumns(values));
  },

  async updateLoad(id, values) {
    const rows = await db
      .update(schema.loads)
      .set({ ...toColumns(values), updatedAt: new Date() })
      .where(eq(schema.loads.id, id))
      .returning({ id: schema.loads.id });
    return rows.length === 1;
  },

  async deleteLoad(id) {
    const rows = await db.delete(schema.loads).where(eq(schema.loads.id, id)).returning({ id: schema.loads.id });
    return rows.length === 1;
  },
};
