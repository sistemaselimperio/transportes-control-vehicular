import { connection } from "next/server";
import { todayInBogota, type IsoDate } from "@/modules/shared/domain/dates";

/**
 * Today in Colombia, read at request time. Cached reads take it as an argument so their entries
 * roll over at midnight instead of serving yesterday's expiry statuses; the clock cannot be read
 * inside the cache scope or during prerender, hence `connection()`.
 */
export async function currentDay(): Promise<IsoDate> {
  await connection();
  return todayInBogota();
}
