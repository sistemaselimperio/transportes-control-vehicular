/**
 * Trips start at a date and hour typed in Colombia local time (UTC-5, no daylight saving). The
 * database stores the instant; these helpers convert from and to the `datetime-local` format.
 */
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** The instant of a `YYYY-MM-DDTHH:mm[:ss]` value read as Colombia time, or null when it is not a real date. */
export function parseLocalInput(value: string): Date | null {
  const m = LOCAL_INPUT.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((part) => (part === undefined ? 0 : Number(part)));
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const valid =
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === mo - 1 &&
    utc.getUTCDate() === d &&
    utc.getUTCHours() === h &&
    utc.getUTCMinutes() === mi &&
    utc.getUTCSeconds() === s;
  if (!valid) return null;
  return new Date(utc.getTime() + 5 * 3_600_000);
}

function bogotaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** `YYYY-MM-DDTHH:mm` in Colombia time: the value of a `datetime-local` input. */
export function toLocalInput(date: Date): string {
  const p = bogotaParts(date);
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}`;
}

/** Now, as a `datetime-local` value. */
export function currentLocalInput(now: Date = new Date()): string {
  return toLocalInput(now);
}

/** Operator-facing `dd/mm/yyyy HH:mm` (24h, Colombia time) of an ISO instant. */
export function formatTripDateTime(iso: string): string {
  const p = bogotaParts(new Date(iso));
  return `${p.d}/${p.mo}/${p.y} ${p.h}:${p.mi}`;
}
