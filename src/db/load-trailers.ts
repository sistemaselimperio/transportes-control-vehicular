/**
 * Idempotent load of the company trailers: vehicles of class "Remolque" with their owner.
 * Run with `npm run db:load-trailers` against the database in DATABASE_URL (.env.local / .env).
 * Plates that already exist are skipped; owners are matched by document number or by name
 * (ignoring case and accents) and created only when missing. Ownership starts today.
 * Requires the vehicle classes from `npm run db:seed`.
 */
import "./load-env";

import { eq } from "drizzle-orm";
import { todayInBogota } from "../modules/shared/domain/dates";
import { TRAILER_CLASS_NAME } from "../modules/vehicles/domain/trailer";
import { planTrailerLoad, TRAILERS_TO_LOAD } from "../modules/vehicles/domain/trailer-load";
import { db, schema } from "./index";

async function main() {
  const [trailerClass] = await db
    .select({ id: schema.vehicleClasses.id })
    .from(schema.vehicleClasses)
    .where(eq(schema.vehicleClasses.name, TRAILER_CLASS_NAME));
  if (!trailerClass) throw new Error(`Class '${TRAILER_CLASS_NAME}' not found: run 'npm run db:seed' first.`);

  const [vehicles, owners] = await Promise.all([
    db.select({ plate: schema.vehicles.plate }).from(schema.vehicles),
    db
      .select({ id: schema.owners.id, name: schema.owners.name, documentNumber: schema.owners.documentNumber })
      .from(schema.owners),
  ]);
  const plan = planTrailerLoad(
    TRAILERS_TO_LOAD,
    vehicles.map((v) => v.plate),
    owners,
  );

  const today = todayInBogota();
  await db.transaction(async (tx) => {
    const ownerIds = new Map<string, number>();
    for (const owner of plan.newOwners) {
      const [row] = await tx
        .insert(schema.owners)
        .values({ name: owner.name, documentNumber: owner.documentNumber, group: owner.group })
        .returning({ id: schema.owners.id });
      ownerIds.set(owner.key, row.id);
    }
    for (const trailer of plan.trailers) {
      const [row] = await tx
        .insert(schema.vehicles)
        .values({ plate: trailer.plate, classId: trailerClass.id, status: trailer.status })
        .returning({ id: schema.vehicles.id });
      if (!trailer.owner) continue;
      const ownerId = trailer.owner.kind === "existing" ? trailer.owner.id : ownerIds.get(trailer.owner.key)!;
      await tx.insert(schema.ownerships).values({ vehicleId: row.id, ownerId, fromDate: today });
    }
  });

  console.log(
    `Trailers created: ${plan.trailers.length}. Owners created: ${plan.newOwners.length}. ` +
      `Already existing (skipped): ${plan.skippedPlates.length}${plan.skippedPlates.length ? ` (${plan.skippedPlates.join(", ")})` : ""}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
