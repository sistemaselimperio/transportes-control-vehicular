import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { sortDriverRows, type DriverRow } from "../domain/driver-row";
import { loadDriverRows } from "../infrastructure/driver-repository";

/** Company-wide driver list; the page filters it by company. */
export async function listDriverRows(): Promise<DriverRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(...readTags("driverRows"));

  return sortDriverRows(await loadDriverRows());
}
