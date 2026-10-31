/**
 * Supabase Storage adapter for the vehicle-file bytes. Server-side only: it uses the service
 * role key, which bypasses RLS and must never reach the browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VehicleFileStorage } from "../application/vehicle-file-ports";
import { VEHICLE_FILES_BUCKET, isStorageNotFound, supabaseUrl } from "./supabase-config";

/** The Storage API removes up to 1000 objects per request. */
const REMOVE_CHUNK = 1000;

let client: SupabaseClient | undefined;

/** Created on first use so a missing env var does not break imports or the build. */
function bucket() {
  if (!client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
    client = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client.storage.from(process.env.SUPABASE_FILES_BUCKET || VEHICLE_FILES_BUCKET);
}

export const supabaseFileStorage: VehicleFileStorage = {
  async put(path, data, mimeType) {
    const { error } = await bucket().upload(path, data, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`, { cause: error });
  },

  async get(path) {
    const { data, error } = await bucket().download(path);
    if (error) {
      if (isStorageNotFound(error as { status?: number; code?: string; message?: string })) return null;
      throw new Error(`Storage download failed: ${error.message}`, { cause: error });
    }
    return Buffer.from(await data.arrayBuffer());
  },

  async remove(paths) {
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
      const { error } = await bucket().remove(paths.slice(i, i + REMOVE_CHUNK));
      if (error) throw new Error(`Storage remove failed: ${error.message}`, { cause: error });
    }
  },
};
