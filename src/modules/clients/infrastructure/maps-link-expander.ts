/**
 * Expands a short Google Maps link (maps.app.goo.gl) by following its redirects one hop at a time,
 * without downloading the Maps page. Only https hops to Google hosts are followed, so a pasted link
 * can never make the server call anything else. Any failure gives null: the finca is saved anyway.
 */
import { parseMapsCoordinates } from "../domain/maps-link";

const MAX_HOPS = 5;
const TIMEOUT_MS = 5000;
const GOOGLE_HOST = /(?:^|\.)(?:goo\.gl|google\.[a-z]{2,3}(?:\.[a-z]{2})?)$/;

function isAllowed(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && GOOGLE_HOST.test(hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function expandMapsLink(url: string): Promise<string | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let current = url;
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (!isAllowed(current)) return null;
      const response = await fetch(current, { method: "GET", redirect: "manual", signal });
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) return hop === 0 ? null : current;
      current = new URL(location, current).toString();
      // Stop as soon as the coordinates show up: the next hop could be a consent or login page.
      if (parseMapsCoordinates(current)) return current;
    }
    return current;
  } catch (e) {
    console.error("maps link expansion failed", e);
    return null;
  }
}
