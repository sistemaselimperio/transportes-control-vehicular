/**
 * A page left open across a deploy still calls the Server Actions of the build it was loaded
 * from; the new server no longer knows them and the call fails. Reloading fetches the page of the
 * current build, so the next try works. A guard keeps a persistent mismatch from reload-looping.
 */
import { unstable_isUnrecognizedActionError } from "next/navigation";

const RELOAD_AT_KEY = "stale-deployment-reload-at";
export const RELOAD_GUARD_MS = 60_000;

export function shouldReloadForStaleDeployment(isUnrecognizedAction: boolean, lastReloadAt: string | null, now: number): boolean {
  if (!isUnrecognizedAction) return false;
  const last = Number(lastReloadAt);
  return !Number.isFinite(last) || lastReloadAt === null || now - last > RELOAD_GUARD_MS;
}

/** Reloads the page when `error` comes from an older deployment; true when it did. */
export function reloadIfStaleDeployment(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  let lastReloadAt: string | null = null;
  try {
    lastReloadAt = window.sessionStorage.getItem(RELOAD_AT_KEY);
  } catch {
    // Storage blocked: reload without the guard's memory.
  }
  const now = Date.now();
  if (!shouldReloadForStaleDeployment(unstable_isUnrecognizedActionError(error), lastReloadAt, now)) return false;
  try {
    window.sessionStorage.setItem(RELOAD_AT_KEY, String(now));
  } catch {
    // Same as above.
  }
  window.location.reload();
  return true;
}
