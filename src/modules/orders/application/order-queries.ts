import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import type { OrderRow } from "../domain/order-rules";
import { loadKgPerBag, loadOrderRows, loadReferenceNames } from "../infrastructure/order-repository";

/** Every order with its lines, newest delivery day first; company-wide, filtered on the client. */
export async function listOrderRows(): Promise<OrderRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("orderRows"));

  return loadOrderRows();
}

/** The reference catalog, for the suggestions of the order form. */
export async function listOrderReferences(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("orderReferences"));

  return loadReferenceNames();
}

/** The global kilograms per bag every weight of the orders is computed with. */
export async function getKgPerBag(): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("kgPerBag"));

  return loadKgPerBag();
}
