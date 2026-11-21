import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { EnsureReferences } from "../application/reference-resolver";

/** The id of every reference by key, creating the unknown ones; shared by the orders and the loads. */
export const ensureReferences: EnsureReferences = async (refs) => {
  if (refs.length === 0) return new Map();
  // A concurrent write may create the same name first: the unique key makes the insert a no-op.
  await db
    .insert(schema.orderReferences)
    .values(refs.map((r) => ({ name: r.name, nameKey: r.key })))
    .onConflictDoNothing({ target: schema.orderReferences.nameKey });
  const rows = await db
    .select({ id: schema.orderReferences.id, nameKey: schema.orderReferences.nameKey })
    .from(schema.orderReferences)
    .where(inArray(schema.orderReferences.nameKey, refs.map((r) => r.key)));
  return new Map(rows.map((r) => [r.nameKey, r.id]));
};
