import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { sortSaleRows, type SaleRow } from "../domain/sale-row";
import { loadSaleRows } from "../infrastructure/sale-repository";

/** Company-wide sales list; the page filters it by group and year. */
export async function listSaleRows(): Promise<SaleRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(...readTags("saleRows"));

  return sortSaleRows(await loadSaleRows());
}
