import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OwnerRow } from "../domain/owner-row";

/** Every owner with the plates of the vehicles they currently hold (open ownerships). */
export async function loadOwnerRows(): Promise<OwnerRow[]> {
  const [owners, current] = await Promise.all([
    db.select().from(schema.owners),
    db
      .select({ ownerId: schema.ownerships.ownerId, plate: schema.vehicles.plate })
      .from(schema.ownerships)
      .innerJoin(schema.vehicles, eq(schema.ownerships.vehicleId, schema.vehicles.id))
      .where(isNull(schema.ownerships.toDate))
      .orderBy(asc(schema.vehicles.plate)),
  ]);

  const plates = new Map<number, string[]>();
  for (const o of current) {
    const list = plates.get(o.ownerId) ?? [];
    list.push(o.plate);
    plates.set(o.ownerId, list);
  }

  return owners.map((o) => ({
    id: o.id,
    name: o.name,
    documentNumber: o.documentNumber,
    group: o.group,
    plates: plates.get(o.id) ?? [],
  }));
}

type OwnerValues = Omit<OwnerRow, "id" | "plates">;

/** Id of the owner holding that document number, ignoring `exceptId`. */
export async function findOwnerIdByDocument(documentNumber: string, exceptId?: number) {
  const rows = await db
    .select({ id: schema.owners.id })
    .from(schema.owners)
    .where(
      and(
        eq(schema.owners.documentNumber, documentNumber),
        exceptId == null ? undefined : ne(schema.owners.id, exceptId),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function insertOwner(values: OwnerValues) {
  await db.insert(schema.owners).values(values);
}

/** Returns false when no owner has that id. */
export async function updateOwner(id: number, values: OwnerValues) {
  const rows = await db
    .update(schema.owners)
    .set(values)
    .where(eq(schema.owners.id, id))
    .returning({ id: schema.owners.id });
  return rows.length === 1;
}

/** Removes every owner and their ownership links (the vehicles stay); returns how many owners went. */
export async function deleteAllOwners() {
  return db.transaction(async (tx) => {
    await tx.delete(schema.ownerships);
    const rows = await tx.delete(schema.owners).returning({ id: schema.owners.id });
    return rows.length;
  });
}
