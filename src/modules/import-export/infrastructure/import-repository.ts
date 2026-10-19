import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import { addMonths, type IsoDate } from "@/modules/shared/domain/dates";
import { driverKey, stripAccents } from "../domain/cell-parsers";
import type { OwnerRef, ParsedVehicle } from "../domain/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findExistingPlates(plates: string[]): Promise<Set<string>> {
  if (plates.length === 0) return new Set();
  const rows = await db
    .select({ plate: schema.vehicles.plate })
    .from(schema.vehicles)
    .where(inArray(schema.vehicles.plate, plates));
  return new Set(rows.map((r) => r.plate));
}

const ownerNameKey = (name: string) =>
  stripAccents(name).toUpperCase().replace(/\s+/g, " ").trim();

/** Resolves (and lazily creates) owner rows; cached for the whole import. */
async function createOwnerResolver(tx: Tx) {
  const all = await tx.select().from(schema.owners);
  const cache = new Map<string, number | null>();

  return async (ref: OwnerRef): Promise<number | null> => {
    if (ref.kind === "UNKNOWN") return null;

    if (ref.kind === "THIRD_PARTY") {
      const key = `T:${ownerNameKey(ref.name)}`;
      if (cache.has(key)) return cache.get(key) ?? null;
      let found = all.find((o) => ownerNameKey(o.name) === ownerNameKey(ref.name));
      if (!found) {
        [found] = await tx
          .insert(schema.owners)
          .values({ name: ref.name, group: "THIRD_PARTY" })
          .returning();
        all.push(found);
      }
      cache.set(key, found.id);
      return found.id;
    }

    const known = KNOWN_OWNERS[ref.kind];
    if (cache.has(ref.kind)) return cache.get(ref.kind) ?? null;
    let found = all.find((o) => o.documentNumber === known.documentNumber);
    if (!found) {
      [found] = await tx
        .insert(schema.owners)
        .values({ ...known })
        .returning();
      all.push(found);
    }
    cache.set(ref.kind, found.id);
    return found.id;
  };
}

function monthsBetween(from: IsoDate, to: IsoDate): number | null {
  for (let m = 1; m <= 24; m++) if (addMonths(from, m) === to) return m;
  return null;
}

export interface ImportOutcome {
  created: string[];
  skippedExisting: string[];
}

/**
 * Writes every non-existing vehicle (and its ownership, documents, tax, oil
 * change, driver assignment and sale) in one transaction. Idempotent by plate.
 */
export async function importVehicles(
  vehicles: ParsedVehicle[],
  today: IsoDate,
): Promise<ImportOutcome> {
  return db.transaction(async (tx) => {
    const classes = await tx.select().from(schema.vehicleClasses);
    const classId = new Map(classes.map((c) => [c.name, c.id]));
    const resolveOwner = await createOwnerResolver(tx);

    const existingDrivers = await tx.select().from(schema.drivers);
    const driverIds = new Map(existingDrivers.map((d) => [driverKey(d.name), d.id]));

    const existing = await findExistingPlatesTx(
      tx,
      vehicles.map((v) => v.plate),
    );
    const outcome: ImportOutcome = { created: [], skippedExisting: [] };

    for (const v of vehicles) {
      if (existing.has(v.plate)) {
        outcome.skippedExisting.push(v.plate);
        continue;
      }
      const cid = classId.get(v.className);
      if (cid == null) {
        throw new Error(
          `Falta la clase "${v.className}" en la base de datos. Ejecuta "npm run db:seed" y vuelve a intentar.`,
        );
      }

      const [{ id: vehicleId }] = await tx
        .insert(schema.vehicles)
        .values({
          plate: v.plate,
          classId: cid,
          brandLine: v.brandLine,
          notes: v.notes.length > 0 ? v.notes.join("\n") : null,
          municipality: v.municipality,
          serviceType: v.serviceType,
          status: v.status,
          oilMode: v.odometerWorking ? "both" : "date",
          odometerWorking: v.odometerWorking,
          currentKm: v.currentKm,
          currentKmAt: v.currentKmAt,
        })
        .returning({ id: schema.vehicles.id });
      outcome.created.push(v.plate);

      const ownerId = await resolveOwner(v.owner);
      if (ownerId != null) {
        await tx
          .insert(schema.ownerships)
          .values({ vehicleId, ownerId, fromDate: today });
      }

      const docs = [
        { type: "POLICY" as const, doc: v.policy },
        { type: "SOAT" as const, doc: v.soat },
        { type: "TECNO" as const, doc: v.tecno },
      ];
      for (const { type, doc } of docs) {
        if (!doc) continue;
        await tx.insert(schema.vehicleDocuments).values({
          vehicleId,
          type,
          policyKind: type === "POLICY" ? doc.kind : null,
          expiresOn: doc.expiresOn,
          notApplicable: doc.notApplicable,
        });
      }

      await tx.insert(schema.vehicleTaxes).values({
        vehicleId,
        kind: v.tax.kind,
        year: v.tax.year,
      });

      if (v.oilChange) {
        const { date, km, nextKm, nextDate } = v.oilChange;
        await tx.insert(schema.oilChanges).values({
          vehicleId,
          date,
          km,
          nextKm,
          nextDate,
          intervalKm: km != null && nextKm != null && nextKm > km ? nextKm - km : null,
          intervalMonths: nextDate ? monthsBetween(date, nextDate) : null,
        });
      }

      if (v.driver) {
        const key = driverKey(v.driver.name);
        let driverId = driverIds.get(key);
        if (driverId == null) {
          [{ id: driverId }] = await tx
            .insert(schema.drivers)
            .values({ name: v.driver.name, phone: v.driver.phone })
            .returning({ id: schema.drivers.id });
          driverIds.set(key, driverId);
        } else if (v.driver.phone) {
          // Fill a missing phone, never overwrite one the operator already has.
          const [current] = await tx
            .select({ phone: schema.drivers.phone })
            .from(schema.drivers)
            .where(eq(schema.drivers.id, driverId));
          if (current && !current.phone) {
            await tx
              .update(schema.drivers)
              .set({ phone: v.driver.phone })
              .where(eq(schema.drivers.id, driverId));
          }
        }
        await tx
          .insert(schema.driverAssignments)
          .values({ vehicleId, driverId, fromDate: today });
      }

      if (v.sale) {
        await tx
          .insert(schema.sales)
          .values({ vehicleId, date: null, buyer: v.sale.buyer });
      }
    }
    return outcome;
  });
}

async function findExistingPlatesTx(tx: Tx, plates: string[]): Promise<Set<string>> {
  if (plates.length === 0) return new Set();
  const rows = await tx
    .select({ plate: schema.vehicles.plate })
    .from(schema.vehicles)
    .where(inArray(schema.vehicles.plate, plates));
  return new Set(rows.map((r) => r.plate));
}
