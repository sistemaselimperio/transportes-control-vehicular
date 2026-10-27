import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

function createClient() {
  // Hosted Supabase Postgres (shared project, `transportes` schema); there is no local database.
  // DATABASE_URL must be the session pooler (port 5432): through the transaction pooler (6543)
  // a connection that queues a second query never gets its result back, which hangs any page
  // whose parallel reads outnumber `max`.
  // The session pooler admits only `pool_size` (15) clients for the whole project, shared by every
  // warm function instance, so each instance keeps a single connection; queued queries wait on it.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  return postgres(url, {
    prepare: false,
    max: 1,
    // Each session-pooler client holds a server connection shared with the other app; release idle ones.
    idle_timeout: 20,
  });
}

// Reuse only the connection across HMR reloads in development. The drizzle
// instance is rebuilt on every evaluation: it caches column names per table,
// so a long-lived one breaks queries after a schema change (e.g. a new column).
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client = (globalForDb.__pg ??= createClient());

export const db: Database = drizzle(client, { schema });
export { schema };
