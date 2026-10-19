import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { LOCAL_DATABASE_URL } from "./src/db/local-url";

config({ path: ".env.local" });
config({ path: ".env" });

// DATABASE_URL set   -> hosted Supabase Postgres.
// DATABASE_URL unset -> local pglite-server (start it with `npm run db:server`).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL || LOCAL_DATABASE_URL },
});
