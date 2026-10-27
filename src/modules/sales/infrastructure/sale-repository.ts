import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { previousOwnerAtSale, type OwnershipPeriod, type SaleRow } from "../domain/sale-row";

/** Every sale with its vehicle and the owner the vehicle had when it was sold. */
export async function loadSaleRows(): Promise<SaleRow[]> {
  const sales = await db
    .select({
      id: schema.sales.id,
      vehicleId: schema.sales.vehicleId,
      date: schema.sales.date,
      buyer: schema.sales.buyer,
      price: schema.sales.price,
      notes: schema.sales.notes,
      plate: schema.vehicles.plate,
      className: schema.vehicleClasses.name,
    })
    .from(schema.sales)
    .innerJoin(schema.vehicles, eq(schema.sales.vehicleId, schema.vehicles.id))
    .innerJoin(schema.vehicleClasses, eq(schema.vehicles.classId, schema.vehicleClasses.id));
  if (sales.length === 0) return [];

  const ownerships = await db
    .select({
      id: schema.ownerships.id,
      vehicleId: schema.ownerships.vehicleId,
      ownerName: schema.owners.name,
      group: schema.owners.group,
      fromDate: schema.ownerships.fromDate,
      toDate: schema.ownerships.toDate,
    })
    .from(schema.ownerships)
    .innerJoin(schema.owners, eq(schema.ownerships.ownerId, schema.owners.id))
    .where(inArray(schema.ownerships.vehicleId, [...new Set(sales.map((s) => s.vehicleId))]));

  const periods = new Map<number, OwnershipPeriod[]>();
  for (const { vehicleId, ...period } of ownerships) {
    const list = periods.get(vehicleId) ?? [];
    list.push(period);
    periods.set(vehicleId, list);
  }

  return sales.map(({ vehicleId, ...s }) => {
    const previous = previousOwnerAtSale(s.date, periods.get(vehicleId) ?? []);
    return { ...s, previousOwner: previous?.ownerName ?? null, previousOwnerGroup: previous?.group ?? null };
  });
}

type SaleValues = Pick<SaleRow, "date" | "buyer" | "price" | "notes">;

/** Returns false when no sale has that id. */
export async function updateSale(id: number, values: SaleValues) {
  const rows = await db
    .update(schema.sales)
    .set(values)
    .where(eq(schema.sales.id, id))
    .returning({ id: schema.sales.id });
  return rows.length === 1;
}

/** Removes every sale; returns how many went. */
export async function deleteAllSales() {
  const rows = await db.delete(schema.sales).returning({ id: schema.sales.id });
  return rows.length;
}
