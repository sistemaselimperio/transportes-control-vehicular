import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

function createPool() {
  // Hosted Supabase Postgres (shared project, `transportes` schema); there is no local database.
  // DATABASE_URL must be the session pooler (port 5432): through the transaction pooler (6543)
  // a connection that queues a second query never gets its result back, which hangs any page
  // whose parallel reads outnumber the pool size.
  // The session pooler admits only `pool_size` (15) clients for the whole project, shared by every
  // warm function instance, so each instance keeps a tiny pool; queued queries wait for a client.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  const pool = new Pool({
    connectionString: url,
    max: process.env.NODE_ENV === "production" ? 2 : 1,
    idleTimeoutMillis: 5_000,
  });
  // A suspended Fluid instance cannot run idle timers, so without this its connections stay
  // open and hold pooler slots until the instance dies; this releases them before suspension.
  attachDatabasePool(pool);
  return pool;
}

// Reuse only the pool across HMR reloads in development. The drizzle
// instance is rebuilt on every evaluation: it caches column names per table,
// so a long-lived one breaks queries after a schema change (e.g. a new column).
const globalForDb = globalThis as unknown as { __pgPool?: Pool };
const pool = (globalForDb.__pgPool ??= createPool());

export const db: Database = drizzle(pool, { schema });
export { schema };
