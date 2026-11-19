import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import type { ClientRow } from "../domain/client-row";
import { loadClientRows } from "../infrastructure/client-repository";

/** Every client by name, with its number of deliveries; shared by everyone who can open the commercial area. */
export async function listClientRows(): Promise<ClientRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("clientRows"));

  return loadClientRows();
}
