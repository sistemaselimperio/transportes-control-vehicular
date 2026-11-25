import { parseDecimal } from "@/modules/shared/domain/decimal";

const KG_UNIT = /\b(kgs?|kilos?|kilogramos?)\b\.?/i;
const TON_UNIT = /\b(tons?|toneladas?|t)\b\.?/i;

/** No loaded truck carries more tons than this: a bare number above it was written in kilograms. */
const MAX_PLAUSIBLE_TONS = 100;
/** Dots or commas that only group thousands: "12.880", "1,234,567". */
const THOUSANDS_GROUPING = /^\d{1,3}([.,]\d{3})+$/;

/**
 * The tons of a cotero receipt, always in tons. The paper may say "33.213", "12.88 t" or "12.880 Kg":
 * with a kilogram unit the separators group thousands and the value is divided by 1.000; a bare number
 * above any plausible load is read as kilograms too. Rounded to three decimals; `null` when blank,
 * zero or not a number.
 */
export function parseTons(raw: string): number | null {
  const isKg = KG_UNIT.test(raw);
  const text = raw.replace(KG_UNIT, "").replace(TON_UNIT, "").replace(/\s+/g, "");
  if (text === "") return null;

  let value: number | null;
  if (isKg && THOUSANDS_GROUPING.test(text)) value = Number(text.replace(/[.,]/g, ""));
  else value = parseDecimal(text);
  if (value === null) return null;

  const tons = isKg || value > MAX_PLAUSIBLE_TONS ? value / 1000 : value;
  const rounded = Math.round(tons * 1000) / 1000;
  return rounded > 0 ? rounded : null;
}

/** The largest peso amount the database column holds. */
export const MAX_PESOS = 2_000_000_000;

/**
 * Pesos as handwritten: "$325'498", "$126.224", "1.250.000". Apostrophes, dots and commas group
 * thousands; one or two digits after the last separator are cents and dropped. Whole pesos, or `null`
 * when blank, zero, without digits or above `MAX_PESOS`.
 */
export function parseCop(raw: string): number | null {
  let text = raw.replace(/[$\s'’´`]/g, "");
  if (!/^[\d.,]+$/.test(text)) return null;
  text = text.replace(/[.,]\d{1,2}$/, "");
  const digits = text.replace(/[.,]/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return value > 0 && value <= MAX_PESOS ? value : null;
}
