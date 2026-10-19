/**
 * CLI importer: `npm run db:import -- "<path>.xlsx" [--dry]`.
 * Internal tool for loading or re-syncing data from the source Excel.
 */
import "./load-env";

import { readFile } from "node:fs/promises";
import {
  confirmImport,
  previewImport,
} from "../modules/import-export/application/import-use-cases";

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('Usage: npm run db:import -- "<file>.xlsx" [--dry]');
    process.exit(1);
  }
  const data = new Uint8Array(await readFile(file));

  if (flag === "--dry") {
    const preview = await previewImport(data);
    console.log(JSON.stringify(preview.totals, null, 2));
    for (const s of preview.sheets) console.log(s.sheet, s.counts);
  } else {
    console.log(JSON.stringify(await confirmImport(data), null, 2));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
