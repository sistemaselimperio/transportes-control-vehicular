/**
 * Phase 2 of the storage move: copies the bytes of legacy vehicle files (rows with `data` and no
 * `storage_path`) into the Storage bucket and records the path. Idempotent and resumable: each
 * row is committed on its own, so an interrupted run simply continues with what is left.
 * `data` is kept untouched (it is dropped in a later migration). Every network call is retried
 * because the connection to Supabase can drop.
 *
 *   npm run storage:migrate-files -- --dry-run   # only reports what is pending
 *   npm run storage:migrate-files
 */
import "./load-env";

import { Pool } from "pg";
import { supabaseFileStorage as storage } from "../modules/documents/infrastructure/supabase-file-storage";
import { withRetry } from "../lib/retry";

const dryRun = process.argv.includes("--dry-run");

const retry = <T>(label: string, fn: () => Promise<T>) =>
  withRetry(fn, {
    onRetry: (attempt, e) => console.warn(`  retry ${attempt} (${label}): ${e instanceof Error ? e.message : e}`),
  });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  const pool = new Pool({ connectionString: url, max: 1 });
  // An idle client dropped by the network must not crash the run; the next query reconnects.
  pool.on("error", (e) => console.warn("  pool error:", e.message));

  try {
    const { rows: pending } = await retry("list", () =>
      pool.query<{ id: string; vehicle_id: number; size_bytes: number }>(
        `select id, vehicle_id, size_bytes from transportes.vehicle_files
         where storage_path is null and data is not null order by id`,
      ),
    );
    const totalBytes = pending.reduce((sum, r) => sum + r.size_bytes, 0);
    console.log(`pending: ${pending.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
    if (dryRun || pending.length === 0) return;

    const failed: string[] = [];
    for (const [i, row] of pending.entries()) {
      const path = `${row.vehicle_id}/${row.id}`;
      try {
        const { rows } = await retry("read", () =>
          pool.query<{ data: Buffer; mime_type: string }>(
            "select data, mime_type from transportes.vehicle_files where id = $1",
            [row.id],
          ),
        );
        const { data, mime_type } = rows[0];
        // A previous run may have uploaded the object and died before recording the path.
        const existing = await retry("check", () => storage.get(path));
        if (!existing) await retry("upload", () => storage.put(path, data, mime_type));
        const stored = existing ?? (await retry("verify", () => storage.get(path)));
        if (!stored || !stored.equals(data)) throw new Error("stored object does not match the database bytes");
        await retry("record", () =>
          pool.query(
            "update transportes.vehicle_files set storage_path = $2 where id = $1 and storage_path is null",
            [row.id, path],
          ),
        );
        console.log(`[${i + 1}/${pending.length}] ok ${path}`);
      } catch (e) {
        failed.push(row.id);
        console.error(`[${i + 1}/${pending.length}] FAILED ${path}: ${e instanceof Error ? e.message : e}`);
      }
    }

    console.log(`done: ${pending.length - failed.length} migrated, ${failed.length} failed`);
    if (failed.length > 0) {
      console.log("run the script again to retry the failed files:", failed);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
