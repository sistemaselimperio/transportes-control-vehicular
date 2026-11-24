/**
 * A vehicle's cargo capacity: a number of tons (decimals allowed, always > 0), or null when unknown.
 * Kept as a plain number so loads and deliveries can later be validated against it.
 */
import { RuleError } from "./vehicle-rules";

/** Largest value of the `numeric(8, 2)` column. */
export const MAX_CAPACITY_TONS = 999_999.99;

export const CAPACITY_ERROR = "La capacidad debe ser un número de toneladas mayor que 0.";

const TON_UNIT = "(?:t|ton|tons|tonelada|toneladas)";
const KILO_UNIT = "(?:kg|kgs|kilo|kilos|kilogramo|kilogramos)";
const LOOSE = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*${TON_UNIT}?\.?$`, "i");
const LEGACY_TONS = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*${TON_UNIT}\.?$`, "i");
const LEGACY_KILOS = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*${KILO_UNIT}\.?$`, "i");
const BARE_NUMBER = /^(\d+(?:[.,]\d+)?)$/;

/** Below this, a bare legacy number was an occupant count, not kilos. */
const MIN_LEGACY_KILOS = 100;

function amount(match: RegExpMatchArray): number {
  return Number(match[1]!.replace(",", "."));
}

function toTons(value: number): number | null {
  const tons = Math.round(value * 100) / 100;
  return tons > 0 && tons <= MAX_CAPACITY_TONS ? tons : null;
}

/**
 * Tons from what a person typed: "34", "8,5", "34 t", "34 ton", "34 toneladas". The unit is
 * optional. Null when blank, not a positive number or out of range.
 */
export function parseCapacityTons(raw: string): number | null {
  const match = raw.trim().match(LOOSE);
  return match ? toTons(amount(match)) : null;
}

/**
 * Tons from a legacy capacity (the old free-text column, the logbook sheet), which recorded kilos:
 * "34 t" stays 34; "15000 KILO" and a bare 15000 become 15. A bare number under 100 was an occupant
 * count and anything else is unreadable: both are null. Mirrors migration 0030.
 */
export function parseLegacyCapacityTons(raw: string | number): number | null {
  const text = String(raw).trim();
  const tons = text.match(LEGACY_TONS);
  if (tons) return toTons(amount(tons));
  const kilos = text.match(LEGACY_KILOS);
  if (kilos) return toTons(amount(kilos) / 1000);
  const bare = text.match(BARE_NUMBER);
  if (bare && amount(bare) >= MIN_LEGACY_KILOS) return toTons(amount(bare) / 1000);
  return null;
}

/** "34 t", "8,5 t". */
export function formatCapacityTons(tons: number): string {
  return `${String(tons).replace(".", ",")} t`;
}

export function assertCapacityTons(tons: number | null): void {
  if (tons == null) return;
  if (!Number.isFinite(tons) || tons <= 0 || tons > MAX_CAPACITY_TONS) throw new RuleError(CAPACITY_ERROR);
}
