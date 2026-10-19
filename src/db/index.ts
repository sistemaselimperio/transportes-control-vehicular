import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "./local-url";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

function createClient() {
  // DATABASE_URL set   -> hosted Supabase Postgres.
  // DATABASE_URL unset -> local pglite-server (npm run dev / db:server).
  const url = process.env.DATABASE_URL || LOCAL_DATABASE_URL;
  return postgres(url, {
    // Required by the Supabase transaction pooler (port 6543); harmless elsewhere.
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 1,
  });
}

// Reuse only the connection across HMR reloads in development. The drizzle
// instance is rebuilt on every evaluation: it caches column names per table,
// so a long-lived one breaks queries after a schema change (e.g. a new column).
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
const client = (globalForDb.__pg ??= createClient());

export const db: Database = drizzle(client, { schema });
export { schema };
