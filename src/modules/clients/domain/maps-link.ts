/** Google Maps links of a client: offline coordinate parsing and the links built from it. */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`;

const PIN = new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`);
const QUERY = new RegExp(`[?&](?:q|query|ll)=(${NUMBER})(?:,|%2C)(${NUMBER})(?:[&#]|$)`, "i");
const VIEWPORT = new RegExp(`@(${NUMBER}),(${NUMBER})(?:[,/]|$)`);

function toCoordinates(match: RegExpExecArray | null): Coordinates | null {
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/**
 * Coordinates found in a pasted Google Maps URL: the pin (`!3dLAT!4dLNG`), a query (`?q=`, `query=`,
 * `ll=`) or the viewport (`@lat,lng,`), in that order. Short links (maps.app.goo.gl) hold none and
 * would need a network call to expand, so they give `null`.
 */
export function parseMapsCoordinates(url: string): Coordinates | null {
  const text = url.trim();
  if (text === "") return null;
  return toCoordinates(PIN.exec(text)) ?? toCoordinates(QUERY.exec(text)) ?? toCoordinates(VIEWPORT.exec(text));
}

/** The link to open or share: built from the coordinates when known, else the pasted link, else `null`. */
export function buildMapsLink(client: {
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
}): string | null {
  if (client.latitude !== null && client.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${client.latitude},${client.longitude}`;
  }
  return client.mapsUrl;
}

/** WhatsApp share link with the client's name, address and map link, one per line. */
export function buildWhatsAppShareUrl(client: { name: string; address: string | null; link: string | null }): string {
  const text = [client.name, client.address, client.link].filter((part): part is string => Boolean(part)).join("\n");
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** An absolute http(s) link: anything else (javascript:, bare text) is not a valid maps link. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
