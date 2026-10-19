/**
 * Idempotent seed: owners, vehicle classes and the admin user.
 * Run with `npm run db:seed` (requires SEED_ADMIN_PASSWORD for the admin user).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./index";

const OWNERS = [
  { name: "TRANSPORTES EL IMPERIO", documentNumber: "901838598", group: "IMPERIO" },
  { name: "FABIÁN PÁEZ", documentNumber: "74439231", group: "PAEZ" },
  {
    name: "SANDRA MARCELA PÁEZ PORRAS",
    documentNumber: "1053323036",
    group: "PAEZ",
  },
] as const;

const MONTHS = 2; // observed date interval for all motorized classes
const CLASSES = [
  { name: "Automóvil", oilIntervalKm: 5000, oilIntervalMonths: MONTHS },
  { name: "Campero", oilIntervalKm: 7000, oilIntervalMonths: MONTHS },
  { name: "Camioneta", oilIntervalKm: 7000, oilIntervalMonths: MONTHS },
  { name: "Camión", oilIntervalKm: 7000, oilIntervalMonths: MONTHS },
  { name: "Tractocamión", oilIntervalKm: 20000, oilIntervalMonths: MONTHS },
  { name: "Turbo", oilIntervalKm: 7000, oilIntervalMonths: MONTHS },
  { name: "Motocicleta", oilIntervalKm: 3000, oilIntervalMonths: MONTHS },
  { name: "Motocarro", oilIntervalKm: 3000, oilIntervalMonths: MONTHS },
  { name: "Tractor", oilIntervalKm: 5000, oilIntervalMonths: MONTHS },
  {
    name: "Remolque",
    oilIntervalKm: null,
    oilIntervalMonths: null,
    documentsDefaultNotApplicable: true,
  },
] as const;

async function seedOwners() {
  const existing = await db.select().from(schema.owners);
  for (const owner of OWNERS) {
    if (!existing.some((o) => o.name === owner.name)) {
      await db.insert(schema.owners).values(owner);
    }
  }
}

async function seedClasses() {
  for (const cls of CLASSES) {
    await db
      .insert(schema.vehicleClasses)
      .values(cls)
      .onConflictDoNothing({ target: schema.vehicleClasses.name });
  }
}

async function seedAdmin() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    console.warn("SEED_ADMIN_PASSWORD not set: skipping admin user.");
    return;
  }
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, "rocio"));
  if (existing) {
    console.log("Admin user 'rocio' already exists.");
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({
    id,
    name: "Rocío",
    email: "rocio@transportes.local",
    emailVerified: true,
    username: "rocio",
    displayUsername: "rocio",
  });
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
  });
  console.log("Admin user 'rocio' created.");
}

async function main() {
  await seedOwners();
  await seedClasses();
  await seedAdmin();
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
