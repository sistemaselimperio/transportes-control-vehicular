import { sortSaleRows, type SaleRow } from "../domain/sale-row";
import { loadSaleRows } from "../infrastructure/sale-repository";

export async function listSaleRows(): Promise<SaleRow[]> {
  return sortSaleRows(await loadSaleRows());
}
