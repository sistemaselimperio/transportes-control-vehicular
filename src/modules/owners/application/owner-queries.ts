import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { sortOwnerRows, type OwnerRow } from "../domain/owner-row";
import { loadOwnerRows } from "../infrastructure/owner-repository";

/** Company-wide owner list; the page filters it by group. */
export async function listOwnerRows(): Promise<OwnerRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("ownerRows"));

  return sortOwnerRows(await loadOwnerRows());
}
