import { sortDriverRows, type DriverRow } from "../domain/driver-row";
import { loadDriverRows } from "../infrastructure/driver-repository";

export async function listDriverRows(): Promise<DriverRow[]> {
  return sortDriverRows(await loadDriverRows());
}
