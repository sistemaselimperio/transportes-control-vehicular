import { sortOwnerRows, type OwnerRow } from "../domain/owner-row";
import { loadOwnerRows } from "../infrastructure/owner-repository";

export async function listOwnerRows(): Promise<OwnerRow[]> {
  return sortOwnerRows(await loadOwnerRows());
}
