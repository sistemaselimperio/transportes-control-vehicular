/**
 * One-off: fills the coordinates of fincas that have a Maps link but no latitude/longitude, saved
 * before the link format could be read (e.g. short links that expand to `/maps/search/LAT,+LNG`).
 *
 *   npx tsx scripts/backfill-finca-coordinates.ts           # dry run: only reads and prints
 *   npx tsx scripts/backfill-finca-coordinates.ts --apply   # writes the coordinates
 *
 * Uses the database in DATABASE_URL (.env.local / .env). Only fincas without coordinates are touched,
 * so it can be run again safely.
 */
import "../src/db/load-env";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { planCoordinateBackfill } from "../src/modules/clients/application/coordinate-backfill";
import { expandMapsLink } from "../src/modules/clients/infrastructure/maps-link-expander";

const USAGE = "Usage: npx tsx scripts/backfill-finca-coordinates.ts [--apply]";

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--apply" && a !== "--help");
  if (unknown.length > 0 || args.includes("--help")) {
    console.log(USAGE);
    process.exit(unknown.length > 0 ? 1 : 0);
  }
  const apply = args.includes("--apply");

  const { db, schema } = await import("../src/db");
  const { clientLocations: locations, clients } = schema;

  const rows = await db
    .select({ id: locations.id, name: locations.name, clientName: clients.name, mapsUrl: locations.mapsUrl })
    .from(locations)
    .innerJoin(clients, eq(clients.id, locations.clientId))
    .where(and(isNull(locations.latitude), isNotNull(locations.mapsUrl)));
  const fincas = rows.flatMap((r) => (r.mapsUrl && r.mapsUrl.trim() !== "" ? [{ ...r, mapsUrl: r.mapsUrl }] : []));
  console.log(`Fincas with a Maps link and no coordinates: ${fincas.length}.`);

  const plan = await planCoordinateBackfill(fincas, expandMapsLink);

  if (plan.updates.length > 0) {
    console.log(`\nResolved (${plan.updates.length}):`);
    for (const u of plan.updates) {
      console.log(`  - #${u.id} ${u.clientName} / ${u.name}: ${u.latitude}, ${u.longitude} (${u.source})`);
    }
  }
  if (plan.unresolved.length > 0) {
    console.log(`\nNo coordinates found (${plan.unresolved.length}):`);
    for (const f of plan.unresolved) console.log(`  - #${f.id} ${f.clientName} / ${f.name}: ${f.mapsUrl}`);
  }

  if (!apply) {
    console.log(`\nDry run, nothing written. Run with --apply to update ${plan.updates.length} fincas.`);
    process.exit(0);
  }

  let updated = 0;
  for (const u of plan.updates) {
    const result = await db
      .update(locations)
      .set({ latitude: u.latitude, longitude: u.longitude, updatedAt: new Date() })
      .where(and(eq(locations.id, u.id), isNull(locations.latitude)))
      .returning({ id: locations.id });
    updated += result.length;
  }
  console.log(`\nDone. Updated: ${updated} fincas. Unresolved: ${plan.unresolved.length}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
