/**
 * Idempotent: creates (or re-syncs) the private Supabase Storage bucket for vehicle files
 * through the Storage HTTP API (HTTPS, so it works where the Postgres port is blocked).
 * Needs SUPABASE_SERVICE_ROLE_KEY; SUPABASE_URL defaults to the project of DATABASE_URL.
 * Run with `npm run storage:bucket`.
 */
import "./load-env";

import { ALLOWED_MIME, MAX_FILE_BYTES } from "../modules/documents/domain/vehicle-file-rules";

export const VEHICLE_FILES_BUCKET = "transportes-vehicle-files";

/** The pooler user is `postgres.<project-ref>`; the API lives at https://<project-ref>.supabase.co. */
function supabaseUrl(): string {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  const user = decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").username);
  const ref = user.split(".")[1];
  if (!ref) throw new Error("Set SUPABASE_URL (could not derive it from DATABASE_URL).");
  return `https://${ref}.supabase.co`;
}

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  const base = `${supabaseUrl()}/storage/v1/bucket`;
  // New-style secret keys (sb_secret_…) go only in `apikey`; legacy JWT keys also as Bearer.
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  const settings = {
    public: false,
    file_size_limit: MAX_FILE_BYTES,
    allowed_mime_types: [...ALLOWED_MIME],
  };

  const created = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: VEHICLE_FILES_BUCKET, name: VEHICLE_FILES_BUCKET, ...settings }),
  });
  if (!created.ok) {
    const body = await created.text();
    if (!/already exists|Duplicate/i.test(body)) throw new Error(`create failed (${created.status}): ${body}`);
    const updated = await fetch(`${base}/${VEHICLE_FILES_BUCKET}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(settings),
    });
    if (!updated.ok) throw new Error(`update failed (${updated.status}): ${await updated.text()}`);
  }

  const res = await fetch(`${base}/${VEHICLE_FILES_BUCKET}`, { headers });
  if (!res.ok) throw new Error(`read failed (${res.status}): ${await res.text()}`);
  const { id, public: isPublic, file_size_limit, allowed_mime_types } = await res.json();
  console.log("bucket ready:", { id, public: isPublic, file_size_limit, allowed_mime_types });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e, e instanceof Error && e.cause ? e.cause : "");
  process.exit(1);
});
