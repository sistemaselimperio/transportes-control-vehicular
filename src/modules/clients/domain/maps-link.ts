/** Google Maps links of a client finca: offline coordinate parsing and the links built from it. */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const NUMBER = String.raw`-?\d{1,3}(?:\.\d+)?`;

const PIN = new RegExp(`!3d(${NUMBER})!4d(${NUMBER})`);
const QUERY = new RegExp(`[?&](?:q|query|ll)=(${NUMBER})(?:,|%2C)(${NUMBER})(?:[&#]|$)`, "i");
const PATH = new RegExp(`/maps/(?:search|place)/(${NUMBER})(?:,|%2C)(?:\\+|%20| )*(${NUMBER})(?:[/?#&]|$)`, "i");
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
 * `ll=`), the path (`/maps/search/LAT,+LNG`, where shared short links expand to) or the viewport
 * (`@lat,lng,`), in that order. Short links (maps.app.goo.gl) hold none and would need a network call
 * to expand, so they give `null`.
 */
export function parseMapsCoordinates(url: string): Coordinates | null {
  const text = url.trim();
  if (text === "") return null;
  return (
    toCoordinates(PIN.exec(text)) ??
    toCoordinates(QUERY.exec(text)) ??
    toCoordinates(PATH.exec(text)) ??
    toCoordinates(VIEWPORT.exec(text))
  );
}

/**
 * The link to open or share, in order: built from the coordinates, the pasted link, a Maps search by
 * address. `null` when the finca has none of them.
 */
export function buildMapsLink(location: {
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  address?: string | null;
}): string | null {
  if (location.latitude !== null && location.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }
  if (location.mapsUrl) return location.mapsUrl;
  const address = location.address?.trim();
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

const directions = (destination: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

/**
 * The link shared with the driver: it opens Maps with the route from wherever the phone is (no origin
 * means "current location"). Order: route to the coordinates, the pasted link (its pin beats a rural
 * address), route to the address. `null` when the finca has none of them.
 */
export function buildDirectionsLink(location: {
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  address?: string | null;
}): string | null {
  if (location.latitude !== null && location.longitude !== null) {
    return directions(`${location.latitude},${location.longitude}`);
  }
  if (location.mapsUrl) return location.mapsUrl;
  const address = location.address?.trim();
  return address ? directions(encodeURIComponent(address)) : null;
}

/** A maps.app.goo.gl / goo.gl/maps link: it holds no coordinates until expanded. */
export function isShortMapsLink(url: string): boolean {
  return classifyMapsLink(url).kind === "short";
}

/**
 * A map of the coordinates that can be shown in an iframe. Regular Maps pages refuse to be framed
 * (X-Frame-Options: SAMEORIGIN); this keyless `output=embed` URL redirects to the embeddable page.
 */
export function buildMapsEmbedUrl(coordinates: Coordinates): string {
  return `https://maps.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}&z=15&output=embed`;
}

/** WhatsApp share link with the client, finca, address and map link, one per line. */
export function buildWhatsAppShareUrl(location: {
  clientName: string;
  locationName: string;
  address: string | null;
  link: string | null;
}): string {
  const text = [location.clientName, location.locationName, location.address, location.link]
    .filter((part): part is string => Boolean(part))
    .join("\n");
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

export type MapsLinkCheck =
  | { kind: "empty" }
  | { kind: "coordinates"; lat: number; lng: number }
  | { kind: "short" }
  | { kind: "maps" }
  | { kind: "invalid" };

const GOOGLE_HOST = /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

/**
 * What a pasted link is, for live feedback while typing: coordinates found, a short link (kept as is),
 * a Google Maps link without coordinates, or something that is not a Maps link. Display only; the
 * server keeps its own validation.
 */
export function classifyMapsLink(url: string): MapsLinkCheck {
  const text = url.trim();
  if (text === "") return { kind: "empty" };
  if (!isHttpUrl(text)) return { kind: "invalid" };
  const { hostname, pathname } = new URL(text);
  const host = hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || (host === "goo.gl" && pathname.startsWith("/maps"))) return { kind: "short" };
  const isMaps = GOOGLE_HOST.test(host) && (host.startsWith("maps.") || pathname.startsWith("/maps"));
  if (!isMaps) return { kind: "invalid" };
  const coordinates = parseMapsCoordinates(text);
  return coordinates ? { kind: "coordinates", lat: coordinates.latitude, lng: coordinates.longitude } : { kind: "maps" };
}
