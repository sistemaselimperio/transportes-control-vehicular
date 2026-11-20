/**
 * One-off import of clients (and their fincas) from a CSV with the columns `name,nit,notes`.
 *
 *   npx tsx scripts/import-clients.ts <path-to-csv> [--dry-run]
 *
 * Writes to the database in DATABASE_URL (.env.local / .env). `--dry-run` only reads it to find the
 * clients that already exist and prints what would happen. Clients whose NIT or name already exist
 * (or repeat earlier in the file) are skipped, so the script can be run again safely. Each client is
 * inserted with its fincas in one transaction. The CSV lives outside the repository: never add it.
 */
import "../src/db/load-env";

import { readFile } from "node:fs/promises";
import {
  parseClientImportCsv,
  planClientImport,
  type SkipReason,
} from "../src/modules/clients/domain/client-import";
import { searchKey } from "../src/modules/shared/domain/search-key";

const USAGE = "Usage: npx tsx scripts/import-clients.ts <path-to-csv> [--dry-run]";

const REASON_LABELS: Record<SkipReason, string> = {
  "invalid-name": "name without letters or digits",
  "existing-nit": "NIT already in the database",
  "existing-name": "name already in the database",
  "duplicate-nit-in-file": "NIT repeated earlier in the file",
  "duplicate-name-in-file": "name repeated earlier in the file",
};

function parseArgs(argv: string[]): { file: string | null; dryRun: boolean; help: boolean } {
  const flags = argv.filter((a) => a.startsWith("--"));
  const unknown = flags.filter((f) => f !== "--dry-run" && f !== "--help");
  if (unknown.length > 0) throw new Error(`Unknown option ${unknown[0]}. ${USAGE}`);
  return {
    file: argv.find((a) => !a.startsWith("--")) ?? null,
    dryRun: flags.includes("--dry-run"),
    help: flags.includes("--help"),
  };
}

async function main() {
  const { file, dryRun, help } = parseArgs(process.argv.slice(2));
  if (help || !file) {
    console.log(USAGE);
    process.exit(help ? 0 : 1);
  }

  const rows = parseClientImportCsv(await readFile(file, "utf8"));
  console.log(`Read ${rows.length} clients from the file (blank names and the TOTAL row left out).`);

  // Loaded here, not at the top, so `--help` and a wrong path never need the database.
  const { db, schema } = await import("../src/db");

  const stored = await db.select({ nit: schema.clients.nit, nameKey: schema.clients.nameKey }).from(schema.clients);
  const plan = planClientImport(rows, {
    nits: new Set(stored.flatMap((c) => (c.nit === null ? [] : [c.nit]))),
    nameKeys: new Set(stored.map((c) => c.nameKey)),
  });

  if (plan.skipped.length > 0) {
    console.log(`\nSkipped (${plan.skipped.length}):`);
    for (const s of plan.skipped) console.log(`  - ${s.name}: ${REASON_LABELS[s.reason]}`);
  }

  if (dryRun) {
    console.log(
      `\nDry run, nothing written. To insert: ${plan.toInsert.length} clients, ` +
        `${plan.locationCount} fincas. Skipped: ${plan.skipped.length}.`,
    );
    process.exit(0);
  }

  let locationsCreated = 0;
  for (const row of plan.toInsert) {
    // One transaction per client: it never ends up without its fincas.
    await db.transaction(async (tx) => {
      const [client] = await tx
        .insert(schema.clients)
        .values({ name: row.name, nameKey: row.nameKey, nit: row.nit, notes: row.notes })
        .returning({ id: schema.clients.id });
      await tx.insert(schema.clientLocations).values(
        row.locationNames.map((name) => ({
          clientId: client.id,
          name,
          nameKey: searchKey(name),
        })),
      );
    });
    locationsCreated += row.locationNames.length;
  }

  console.log(
    `\nDone. Inserted: ${plan.toInsert.length} clients. Skipped: ${plan.skipped.length}. ` +
      `Fincas created: ${locationsCreated}.`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
