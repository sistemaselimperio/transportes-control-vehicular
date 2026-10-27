import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

// Migrations run against the session pooler (DATABASE_URL_UNPOOLED) when available;
// the transaction pooler cannot run DDL reliably.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  // The Supabase project is shared: never introspect or touch other apps' schemas.
  schemaFilter: ["transportes"],
  migrations: { schema: "transportes", table: "__drizzle_migrations" },
});
