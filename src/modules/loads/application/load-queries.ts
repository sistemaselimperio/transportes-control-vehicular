import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import type { LoadBalanceRow } from "../domain/load-balance";
import type { LoadRow } from "../domain/load-rules";
import { loadBalanceRows, loadLoadRows } from "../infrastructure/load-repository";

/** Every load, newest day first; company-wide, filtered on the client. */
export async function listLoadRows(): Promise<LoadRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("loadRows"));

  return loadLoadRows();
}

/** The bags the loads left behind, with their trips; they expire with the loads. */
export async function listLoadBalances(): Promise<LoadBalanceRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("loadRows"));

  return loadBalanceRows();
}
