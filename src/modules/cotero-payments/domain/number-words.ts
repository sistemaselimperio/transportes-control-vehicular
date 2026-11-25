/** Spanish words for a peso amount, in capitals, as written on a settlement ("SON: ... PESOS"). */

const UNITS = [
  "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE",
  "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS",
  "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
] as const;
const TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"] as const;
const HUNDREDS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS",
  "NOVECIENTOS",
] as const;

/** 1..999 in words; "UN" (never "UNO") because it always precedes a noun here. */
function below1000(n: number): string {
  if (n === 100) return "CIEN";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const words: string[] = [];
  if (hundreds > 0) words.push(HUNDREDS[hundreds]);
  if (rest > 0) {
    if (rest < 30) words.push(UNITS[rest]);
    else {
      const unit = rest % 10;
      words.push(unit === 0 ? TENS[Math.floor(rest / 10)] : `${TENS[Math.floor(rest / 10)]} Y ${UNITS[unit]}`);
    }
  }
  return words.join(" ");
}

/** 1..999.999 in words; "MIL" alone for 1.000. */
function below1000000(n: number): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const words: string[] = [];
  if (thousands === 1) words.push("MIL");
  else if (thousands > 1) words.push(`${below1000(thousands)} MIL`);
  if (rest > 0) words.push(below1000(rest));
  return words.join(" ");
}

/** 1..999.999.999.999 in words. */
function cardinal(n: number): string {
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const words: string[] = [];
  if (millions === 1) words.push("UN MILLÓN");
  else if (millions > 1) words.push(`${below1000000(millions)} MILLONES`);
  if (rest > 0) words.push(below1000000(rest));
  return words.join(" ");
}

/**
 * "TRESCIENTOS VEINTICINCO MIL CUATROCIENTOS NOVENTA Y OCHO PESOS". Exact millions take "DE": "UN MILLÓN DE PESOS".
 * Whole, non-negative amounts below one billion millions only.
 */
export function pesosInWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0 || amount >= 1e12) throw new RangeError("Amount out of range");
  if (amount === 0) return "CERO PESOS";
  if (amount === 1) return "UN PESO";
  const words = cardinal(amount);
  return amount % 1_000_000 === 0 ? `${words} DE PESOS` : `${words} PESOS`;
}
