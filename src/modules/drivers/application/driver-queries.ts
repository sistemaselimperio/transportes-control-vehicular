import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { sortDriverRows, type DriverRow } from "../domain/driver-row";
import { loadDriverOptions, loadDriverRows, type DriverOption } from "../infrastructure/driver-repository";

/** Company-wide driver list; the page filters it by company. */
export async function listDriverRows(): Promise<DriverRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("driverRows"));

  return sortDriverRows(await loadDriverRows());
}

/** Names and a masked national id hint (never the full id) of the active drivers, for the public inspection form's picker. */
export async function listDriverOptions(): Promise<DriverOption[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("driverOptions"));

  return loadDriverOptions();
}
