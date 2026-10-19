/**
 * Canonical plate: uppercase, no spaces.
 * - Cars/trucks (3 letters + 3 digits) use a hyphen: "ABC-123".
 * - Motorcycles (3 letters + 2 digits + 1 letter) have none: "ABC12D".
 * - Anything else (e.g. trailers "S88490") is only uppercased and stripped of spaces.
 */
export function normalizePlate(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact === "") throw new Error("Plate cannot be empty");

  const car = /^([A-Z]{3})-?(\d{3})$/.exec(compact);
  if (car) return `${car[1]}-${car[2]}`;

  const moto = /^([A-Z]{3})-?(\d{2}[A-Z])$/.exec(compact);
  if (moto) return `${moto[1]}${moto[2]}`;

  return compact;
}
