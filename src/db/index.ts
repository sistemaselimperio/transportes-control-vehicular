import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

function createClient() {
  // Hosted Supabase Postgres (shared project, `transportes` schema); there is no local database.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  return postgres(url, {
    // Supabase's transaction pooler (Supavisor) does not support prepared statements.
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
