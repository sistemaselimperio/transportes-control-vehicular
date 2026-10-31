/**
 * Idempotent seed: owners, vehicle classes and the users (rocio: admin, yellow theme; leidy: staff, sky theme).
 * Run with `npm run db:seed` (each user needs its password variable, SEED_ADMIN_PASSWORD or
 * SEED_LEIDY_PASSWORD; a user without one is skipped).
 */
import "./load-env";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./index";
import type { Theme } from "../lib/theme";

const OWNERS = [
  { name: "Transportes El Imperio", documentNumber: "901838598", group: "IMPERIO" },
  { name: "Fabián Páez", documentNumber: "74439231", group: "PAEZ" },
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

async function seedUser(user: {
  username: string;
  name: string;
  role: "admin" | "staff";
  theme: Theme;
  passwordVar: string;
}) {
  const password = process.env[user.passwordVar];
  if (!password) {
    console.warn(`${user.passwordVar} not set: skipping user '${user.username}'.`);
    return;
  }
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, user.username));
  if (existing) {
    console.log(`User '${user.username}' already exists.`);
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({
    id,
    name: user.name,
    email: `${user.username}@transportes.local`,
    emailVerified: true,
    username: user.username,
    displayUsername: user.username,
    role: user.role,
    theme: user.theme,
  });
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
  });
  console.log(`User '${user.username}' (${user.role}) created.`);
}

const seedAdmin = () =>
  seedUser({ username: "rocio", name: "Rocío", role: "admin", theme: "yellow", passwordVar: "SEED_ADMIN_PASSWORD" });
const seedLeidy = () =>
  seedUser({ username: "leidy", name: "Leidy", role: "staff", theme: "sky", passwordVar: "SEED_LEIDY_PASSWORD" });

async function main() {
  await seedOwners();
  await seedClasses();
  await seedAdmin();
  await seedLeidy();
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
