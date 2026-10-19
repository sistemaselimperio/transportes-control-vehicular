/**
 * Local development database: PGlite served over the Postgres wire protocol
 * by `pglite-server` (see the `dev` and `db:server` npm scripts). A single
 * server process owns ./.pglite, so the app and scripts can connect at once.
 */
export const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54320/postgres";
