/**
 * Matching what is written on a receipt (tractor plate, trailer plate, driver name) against the app's
 * own fleet, with no AI: exact comparison first, then a safe auto-correction for near misses and ranked
 * suggestions for everything else. The server only accepts exact matches (`resolveFleetRefs`).
 */
import { isTrailerClass } from "@/modules/vehicles/domain/trailer";
import { formatVehiclePlate, normalizeVehiclePlate } from "./plates";

/** A vehicle of the fleet that a receipt may name. `plate` is the stored form ("ABC-123", "R-21396"). */
export interface FleetVehicle {
  id: number;
  plate: string;
  isTrailer: boolean;
}

export interface FleetDriver {
  id: number;
  name: string;
}

/** What a receipt can be matched against: the active fleet, loaded once and matched on the client. */
export interface FleetCandidates {
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
}

export type FleetField = "vehiclePlate" | "trailerPlate" | "driverName";

/** A plate is auto-corrected only when exactly one candidate is this many edits away. */
export const PLATE_CORRECTION_DISTANCE = 1;
/** Farther plates are not worth suggesting. */
export const MAX_PLATE_DISTANCE = 3;
/** A driver name is auto-corrected from this normalized similarity (1 = identical)... */
export const DRIVER_CORRECTION_SIMILARITY = 0.85;
/** ...or, for names at least this long, from this many edits. */
export const DRIVER_CORRECTION_MIN_LENGTH = 8;
export const DRIVER_CORRECTION_DISTANCE = 2;
/** The best name must beat the runner-up by this much similarity to be corrected. */
export const DRIVER_CORRECTION_MARGIN = 0.1;
/** Names less similar than this are not suggested (unless they share every word). */
const MIN_SUGGESTION_SIMILARITY = 0.5;
export const MAX_SUGGESTIONS = 5;

/** Number of single-character insertions, deletions or substitutions between two texts. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Lowercase, no accents or punctuation, words separated by one space: how names are compared. */
export function nameKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const similarity = (a: string, b: string) => {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
};

const SELLABLE_OUT = "SOLD";
const DRIVER_OUT = "INACTIVE";

/**
 * The fleet a receipt can name: every vehicle that is not sold (active, idle or in the workshop) and every
 * driver that is not inactive. Trailers are the vehicles of the "Remolque" class.
 */
export function toFleetCandidates(
  vehicleRows: ReadonlyArray<{ id: number; plate: string; status: string; className: string }>,
  driverRows: ReadonlyArray<{ id: number; name: string; status: string }>,
): FleetCandidates {
  return {
    vehicles: vehicleRows
      .filter((r) => r.status !== SELLABLE_OUT)
      .map((r) => ({ id: r.id, plate: r.plate, isTrailer: isTrailerClass(r.className) }))
      .sort((a, b) => a.plate.localeCompare(b.plate)),
    drivers: driverRows
      .filter((r) => r.status !== DRIVER_OUT)
      .map((r) => ({ id: r.id, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}

export const tractorsOf = (fleet: FleetCandidates) => fleet.vehicles.filter((v) => !v.isTrailer);
export const trailersOf = (fleet: FleetCandidates) => fleet.vehicles.filter((v) => v.isTrailer);

export type Match<T> =
  | { status: "empty" }
  | { status: "exact"; item: T }
  /** Very close to a single candidate: swapped in, and the text read is kept to show it. */
  | { status: "corrected"; item: T; original: string }
  | { status: "unmatched"; suggestions: T[] };

const plateKey = (plate: string) => normalizeVehiclePlate(plate);

/** Ranked plates for what is being typed: partial plates first, then similar ones. Empty query: all. */
export function suggestPlates(query: string, candidates: readonly FleetVehicle[], limit = MAX_SUGGESTIONS): FleetVehicle[] {
  const q = plateKey(query);
  const scored: Array<{ item: FleetVehicle; score: number }> = [];
  for (const item of candidates) {
    const key = plateKey(item.plate);
    let score: number;
    if (q === "") score = 0;
    else if (key.startsWith(q)) score = 0;
    else if (key.includes(q)) score = 0.5;
    else {
      const distance = levenshtein(q, key);
      if (distance > MAX_PLATE_DISTANCE) continue;
      score = distance;
    }
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.plate.localeCompare(b.item.plate))
    .slice(0, limit)
    .map((s) => s.item);
}

/** Matches a plate against the candidates of one kind (tractors or trailers). */
export function matchPlate(raw: string, candidates: readonly FleetVehicle[]): Match<FleetVehicle> {
  const key = plateKey(raw);
  if (key === "") return { status: "empty" };
  const exact = candidates.find((c) => plateKey(c.plate) === key);
  if (exact) return { status: "exact", item: exact };
  const nearest = candidates.filter((c) => levenshtein(key, plateKey(c.plate)) === PLATE_CORRECTION_DISTANCE);
  if (nearest.length === 1) return { status: "corrected", item: nearest[0], original: raw.trim() };
  return { status: "unmatched", suggestions: closestPlates(key, candidates) };
}

/** Plates within reach of a whole plate, closest first (no "contains" matches: it is complete). */
function closestPlates(key: string, candidates: readonly FleetVehicle[]): FleetVehicle[] {
  return candidates
    .map((item) => ({ item, distance: levenshtein(key, plateKey(item.plate)) }))
    .filter((s) => s.distance <= MAX_PLATE_DISTANCE)
    .sort((a, b) => a.distance - b.distance || a.item.plate.localeCompare(b.item.plate))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.item);
}

/** Does `word` stand for `other` (same word, one is the start of the other, or one typo apart)? */
function sameWord(word: string, other: string): boolean {
  if (word === other) return true;
  if (word.length >= 3 && (other.startsWith(word) || word.startsWith(other)) && other.length >= 3) return true;
  return word.length >= 5 && other.length >= 5 && levenshtein(word, other) <= 1;
}

/** Whether every word of `small` stands for some word of `big`. */
const coversWords = (small: readonly string[], big: readonly string[]) =>
  small.length > 0 && small.every((w) => big.some((o) => sameWord(w, o)));

interface DriverScore {
  item: FleetDriver;
  /** Lower is better. */
  score: number;
  similarity: number;
}

function scoreDriver(queryKey: string, item: FleetDriver, partial: boolean): DriverScore | null {
  const key = nameKey(item.name);
  const sim = similarity(queryKey, key);
  if (queryKey === key) return { item, score: 0, similarity: 1 };
  const query = queryKey.split(" ");
  const words = key.split(" ");
  let score = 1 - sim;
  const prefixTyping = partial && query.every((w, i) => (i === query.length - 1 ? words.some((o) => o.startsWith(w)) : words.some((o) => o === w || sameWord(w, o))));
  if (prefixTyping) score = Math.min(score, 0.05 + 0.01 * Math.max(0, words.length - query.length));
  else if (coversWords(query, words)) score = Math.min(score, 0.1 + 0.01 * Math.max(0, words.length - query.length));
  else if (coversWords(words, query)) score = Math.min(score, 0.15);
  const related = prefixTyping || coversWords(query, words) || coversWords(words, query);
  if (!related && sim < MIN_SUGGESTION_SIMILARITY) return null;
  return { item, score, similarity: sim };
}

function rankDrivers(raw: string, drivers: readonly FleetDriver[], partial: boolean, limit: number): DriverScore[] {
  const key = nameKey(raw);
  if (key === "") return drivers.slice(0, limit).map((item) => ({ item, score: 0, similarity: 0 }));
  return drivers
    .map((d) => scoreDriver(key, d, partial))
    .filter((s): s is DriverScore => s !== null)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, "es"))
    .slice(0, limit);
}

/** Ranked drivers for what is being typed: names starting with the words typed, then similar names. */
export function suggestDrivers(query: string, drivers: readonly FleetDriver[], limit = MAX_SUGGESTIONS): FleetDriver[] {
  return rankDrivers(query, drivers, true, limit).map((s) => s.item);
}

/** Matches a driver name; "very similar" to a single driver is corrected, a name inside a longer one only suggested. */
export function matchDriver(raw: string, drivers: readonly FleetDriver[]): Match<FleetDriver> {
  const key = nameKey(raw);
  if (key === "") return { status: "empty" };
  const exact = drivers.find((d) => nameKey(d.name) === key);
  if (exact) return { status: "exact", item: exact };

  const ranked = rankDrivers(raw, drivers, false, drivers.length);
  const veryClose = ranked.filter((s) => {
    const distance = levenshtein(key, nameKey(s.item.name));
    return s.similarity >= DRIVER_CORRECTION_SIMILARITY || (key.length >= DRIVER_CORRECTION_MIN_LENGTH && distance <= DRIVER_CORRECTION_DISTANCE);
  });
  if (veryClose.length === 1) {
    const [best] = veryClose;
    const runnerUp = ranked.find((s) => s !== best);
    if (!runnerUp || runnerUp.similarity <= best.similarity - DRIVER_CORRECTION_MARGIN) {
      return { status: "corrected", item: best.item, original: raw.trim() };
    }
  }
  return { status: "unmatched", suggestions: ranked.slice(0, MAX_SUGGESTIONS).map((s) => s.item) };
}

export interface FleetMatch {
  vehicle: Match<FleetVehicle>;
  trailer: Match<FleetVehicle>;
  driver: Match<FleetDriver>;
}

export interface FleetFields {
  vehiclePlate: string;
  trailerPlate: string;
  driverName: string;
}

/** What was read, per field, for every field that was auto-corrected. */
export type CorrectedFields = Partial<Record<FleetField, string>>;

export function matchReceiptFleet(fields: FleetFields, fleet: FleetCandidates): FleetMatch {
  return {
    vehicle: matchPlate(fields.vehiclePlate, tractorsOf(fleet)),
    trailer: matchPlate(fields.trailerPlate, trailersOf(fleet)),
    driver: matchDriver(fields.driverName, fleet.drivers),
  };
}

/** The draft with every matched field written the way the app has it; corrected ones are reported. */
export function applyFleetMatch<T extends FleetFields>(draft: T, match: FleetMatch): { draft: T; corrected: CorrectedFields } {
  const next = { ...draft };
  const corrected: CorrectedFields = {};
  const apply = <I>(field: FleetField, m: Match<I>, text: (item: I) => string) => {
    if (m.status !== "exact" && m.status !== "corrected") return;
    next[field] = text(m.item);
    if (m.status === "corrected") corrected[field] = m.original;
  };
  apply("vehiclePlate", match.vehicle, (v) => v.plate);
  apply("trailerPlate", match.trailer, (v) => v.plate);
  apply("driverName", match.driver, (d) => d.name);
  return { draft: next, corrected };
}

export interface FleetIssue {
  field: FleetField;
  /** "missing": the vehicle or the driver is blank. "not-in-fleet": written, but not an exact active fleet entry. */
  kind: "missing" | "not-in-fleet";
  /** What was written (blank for a missing one). */
  value: string;
}

export interface FleetRefs {
  vehicleId: number;
  trailerId: number | null;
  driverId: number;
  /** Snapshots: plates normalized as stored on a receipt, driver name as the app has it. */
  vehiclePlate: string;
  trailerPlate: string | null;
  driverName: string;
}

/**
 * Strict resolution of what a receipt names: each value must be exactly (ignoring case, hyphens, accents)
 * an entry of the active fleet. Used by the review to block saving and by the server as the real check.
 */
export function resolveFleetRefs(
  fields: FleetFields,
  fleet: FleetCandidates,
): { ok: true; refs: FleetRefs } | { ok: false; issues: FleetIssue[] } {
  const issues: FleetIssue[] = [];
  const vehicle = matchPlate(fields.vehiclePlate, tractorsOf(fleet));
  const trailer = matchPlate(fields.trailerPlate, trailersOf(fleet));
  const driver = matchDriver(fields.driverName, fleet.drivers);

  if (vehicle.status === "empty") issues.push({ field: "vehiclePlate", kind: "missing", value: "" });
  else if (vehicle.status !== "exact") issues.push({ field: "vehiclePlate", kind: "not-in-fleet", value: fields.vehiclePlate.trim() });
  if (trailer.status !== "empty" && trailer.status !== "exact") {
    issues.push({ field: "trailerPlate", kind: "not-in-fleet", value: fields.trailerPlate.trim() });
  }
  if (driver.status === "empty") issues.push({ field: "driverName", kind: "missing", value: "" });
  else if (driver.status !== "exact") issues.push({ field: "driverName", kind: "not-in-fleet", value: fields.driverName.trim() });

  if (issues.length > 0 || vehicle.status !== "exact" || driver.status !== "exact") return { ok: false, issues };
  return {
    ok: true,
    refs: {
      vehicleId: vehicle.item.id,
      trailerId: trailer.status === "exact" ? trailer.item.id : null,
      driverId: driver.item.id,
      vehiclePlate: normalizeVehiclePlate(vehicle.item.plate),
      trailerPlate: trailer.status === "exact" ? normalizeVehiclePlate(trailer.item.plate) : null,
      driverName: driver.item.name,
    },
  };
}

/** The refusal message for one issue, in the words of the screens. */
export function describeFleetIssue({ field, kind, value }: FleetIssue): string {
  if (kind === "missing") return field === "driverName" ? "falta el conductor" : "falta la placa del vehículo";
  if (field === "driverName") return `el conductor ${value} no está en los conductores`;
  const plate = formatVehiclePlate(normalizeVehiclePlate(value));
  if (field === "trailerPlate") return `el trailer ${plate} no está en la flota`;
  return `la placa ${plate} no está en la flota`;
}
