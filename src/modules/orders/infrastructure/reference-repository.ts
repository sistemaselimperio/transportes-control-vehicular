import { and, asc, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CatalogProduct, FindCatalogProducts } from "../domain/catalog";

const catalogColumns = {
  id: schema.orderReferences.id,
  code: schema.orderReferences.code,
  name: schema.orderReferences.name,
  supplier: schema.orderReferences.supplier,
};

/** Legacy products (typed inline before the catalog) have no code and supplier: they are never part of it. */
const isCatalog = isNotNull(schema.orderReferences.code);

function toProducts(rows: Array<{ id: number; code: string | null; name: string; supplier: CatalogProduct["supplier"] | null }>): CatalogProduct[] {
  return rows.flatMap((r) => (r.code === null || r.supplier === null ? [] : [{ id: r.id, code: r.code, name: r.name, supplier: r.supplier }]));
}

/** The whole catalog, by supplier and code; shared by the orders and the loads. */
export async function loadCatalogProducts(): Promise<CatalogProduct[]> {
  const rows = await db
    .select(catalogColumns)
    .from(schema.orderReferences)
    .where(and(isCatalog, isNotNull(schema.orderReferences.supplier)))
    .orderBy(asc(schema.orderReferences.supplier), asc(schema.orderReferences.code));
  return toProducts(rows);
}

/** The catalog products among `ids`; legacy products and unknown ids are left out. */
export const findCatalogProducts: FindCatalogProducts = async (ids) => {
  if (ids.length === 0) return [];
  const rows = await db
    .select(catalogColumns)
    .from(schema.orderReferences)
    .where(and(inArray(schema.orderReferences.id, ids), isCatalog));
  return toProducts(rows);
};
