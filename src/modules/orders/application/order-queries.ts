import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import type { CatalogProduct } from "../domain/catalog";
import type { OrderRow } from "../domain/order-rules";
import { loadKgPerBag, loadOrderRows } from "../infrastructure/order-repository";
import { loadCatalogProducts } from "../infrastructure/reference-repository";

/** Every order with its lines, newest delivery day first; company-wide, filtered on the client. */
export async function listOrderRows(): Promise<OrderRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("orderRows"));

  return loadOrderRows();
}

/** The product catalog (code, name, supplier) the order and load forms pick from. */
export async function listCatalogProducts(): Promise<CatalogProduct[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("orderReferences"));

  return loadCatalogProducts();
}

/** The global kilograms per bag every weight of the orders is computed with. */
export async function getKgPerBag(): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("kgPerBag"));

  return loadKgPerBag();
}
