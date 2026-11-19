import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import type { LoadRow } from "../domain/load-rules";
import { loadLoadRows } from "../infrastructure/load-repository";

/** Every load, newest day first; company-wide, filtered on the client. */
export async function listLoadRows(): Promise<LoadRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("loadRows"));

  return loadLoadRows();
}
