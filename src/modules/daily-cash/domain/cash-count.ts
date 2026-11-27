import { DailyCashError } from "./box-rules";

/** Colombian bills and coins counted in the arqueo, largest first. */
export const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50] as const;

/** Quantity per denomination; a missing denomination counts as zero. */
export type CashCount = Readonly<Partial<Record<number, number>>>;

/** Per denomination: keeps every total (100000 x 100000) well inside int4. */
const MAX_QUANTITY = 100_000;

const KNOWN = new Set<number>(DENOMINATIONS);

/** Cash counted: every denomination times its quantity. */
export function countedTotal(count: CashCount): number {
  let total = 0;
  for (const denomination of DENOMINATIONS) total += denomination * (count[denomination] ?? 0);
  return total;
}

/**
 * The quantities of the arqueo form (text or numbers, blank meaning none) as a count. Zeros are
 * dropped; an unknown denomination or a quantity that is not a whole number is refused.
 */
export function parseCounts(raw: Readonly<Record<string, string | number>>): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const denomination = Number(key);
    if (!KNOWN.has(denomination)) throw new DailyCashError(`La denominación ${key} no existe.`);
    const text = String(value).trim();
    if (text === "") continue;
    if (!/^\d{1,9}$/.test(text) || Number(text) > MAX_QUANTITY) {
      throw new DailyCashError(`La cantidad de ${denomination} debe ser un número entero.`);
    }
    const quantity = Number(text);
    if (quantity > 0) counts[denomination] = quantity;
  }
  return counts;
}
