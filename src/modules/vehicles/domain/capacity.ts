/**
 * A vehicle's cargo capacity: a number of tons (decimals allowed, always > 0), or null when unknown.
 * Kept as a plain number so loads and deliveries can later be validated against it.
 */
import { RuleError } from "./vehicle-rules";

/** Largest value of the `numeric(8, 2)` column. */
export const MAX_CAPACITY_TONS = 999_999.99;

export const CAPACITY_ERROR = "La capacidad debe ser un número de toneladas mayor que 0.";

const TON_UNIT = "(?:t|ton|tons|tonelada|toneladas)";
const LOOSE = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*${TON_UNIT}?\.?$`, "i");
const STRICT = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*${TON_UNIT}\.?$`, "i");

function toTons(match: RegExpMatchArray | null): number | null {
  if (!match) return null;
  const tons = Math.round(Number(match[1]!.replace(",", ".")) * 100) / 100;
  return tons > 0 && tons <= MAX_CAPACITY_TONS ? tons : null;
}

/**
 * Tons from what a person typed: "34", "8,5", "34 t", "34 ton", "34 toneladas". The unit is
 * optional. Null when blank, not a positive number or out of range.
 */
export function parseCapacityTons(raw: string): number | null {
  return toTons(raw.trim().match(LOOSE));
}

/**
 * Tons from a legacy free-text capacity (the old column, the logbook sheet). Stricter than the form:
 * only a value with an explicit ton unit converts, because a bare number was an occupant count.
 */
export function parseLegacyCapacityTons(raw: string): number | null {
  return toTons(raw.trim().match(STRICT));
}

/** "34 t", "8,5 t". */
export function formatCapacityTons(tons: number): string {
  return `${String(tons).replace(".", ",")} t`;
}

export function assertCapacityTons(tons: number | null): void {
  if (tons == null) return;
  if (!Number.isFinite(tons) || tons <= 0 || tons > MAX_CAPACITY_TONS) throw new RuleError(CAPACITY_ERROR);
}
