/**
 * Shared Supabase settings for the vehicle-files storage. Relative imports only and no
 * framework code: the `storage:bucket` script (tsx) imports this too.
 */
export const VEHICLE_FILES_BUCKET = "transportes-vehicle-files";

/** The pooler user is `postgres.<project-ref>`; the API lives at https://<project-ref>.supabase.co. */
export function supabaseUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.SUPABASE_URL) return env.SUPABASE_URL;
  const user = decodeURIComponent(new URL(env.DATABASE_URL ?? "").username);
  const ref = user.split(".")[1];
  if (!ref) throw new Error("Set SUPABASE_URL (could not derive it from DATABASE_URL).");
  return `https://${ref}.supabase.co`;
}

/** True for the Storage API's "object does not exist" answers (404, NoSuchKey, or legacy 400 "not found"). */
export function isStorageNotFound(error: { status?: number; code?: string; message?: string }): boolean {
  return error.status === 404 || error.code === "NoSuchKey" || /not found/i.test(error.message ?? "");
}
