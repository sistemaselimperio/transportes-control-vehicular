/**
 * A non-negative decimal typed by hand: "1250", "1250.5", "1250,5", "1.250,5" or "1,250.5".
 * With both separators the last one is the decimal point; a lone one is read as the decimal point.
 * `null` for blank or anything that is not a plain number.
 */
export function parseDecimal(raw: string): number | null {
  const text = raw.replace(/\s+/g, "");
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);
  const whole = decimalAt === -1 ? text : text.slice(0, decimalAt);
  const fraction = decimalAt === -1 ? "" : text.slice(decimalAt + 1);

  const hasBoth = lastDot !== -1 && lastComma !== -1;
  // Without both separators, a repeated one cannot be a decimal point ("1.2.3").
  if (!hasBoth && /[.,]/.test(whole)) return null;
  const digits = whole.replace(/[.,]/g, "");
  if (digits === "" && fraction === "") return null;

  const value = Number(`${digits === "" ? "0" : digits}${fraction === "" ? "" : `.${fraction}`}`);
  return Number.isFinite(value) ? value : null;
}

/** "1.250,5": thousands with a dot, decimal comma, trailing zeros dropped. */
export function formatDecimal(value: number, maxDecimals = 2): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: maxDecimals, useGrouping: "always" }).format(value);
}
