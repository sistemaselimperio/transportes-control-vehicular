import { db, schema } from "@/db";
import type { IsoDate } from "@/modules/shared/domain/dates";

/** Sale date per vehicle id (null when the sale has no recorded date). */
export async function loadSaleDates(): Promise<Map<number, IsoDate | null>> {
  const rows = await db
    .select({ vehicleId: schema.sales.vehicleId, date: schema.sales.date })
    .from(schema.sales);
  const out = new Map<number, IsoDate | null>();
  for (const r of rows) {
    // A vehicle with several sale rows keeps the latest known date.
    const prev = out.get(r.vehicleId);
    if (!prev || (r.date && r.date > prev)) out.set(r.vehicleId, r.date);
  }
  return out;
}
