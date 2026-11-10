/**
 * Canonical plate: uppercase, no spaces.
 * - Cars/trucks (3 letters + 3 digits) use a hyphen: "ABC-123".
 * - Motorcycles (3 letters + 2 digits + 1 letter) too: "ABC-12D".
 * - Trailers (1 letter + 5 digits) use a hyphen after the letter: "S-88490".
 * - Anything else is only uppercased and stripped of spaces.
 */
export function normalizePlate(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact === "") throw new Error("Plate cannot be empty");

  const car = /^([A-Z]{3})-?(\d{3})$/.exec(compact);
  if (car) return `${car[1]}-${car[2]}`;

  const moto = /^([A-Z]{3})-?(\d{2}[A-Z])$/.exec(compact);
  if (moto) return `${moto[1]}-${moto[2]}`;

  const trailer = /^([A-Z])-?(\d{5})$/.exec(compact);
  if (trailer) return `${trailer[1]}-${trailer[2]}`;

  return compact;
}

/** The two sides of a plate's hyphen ("ABC-123" → ["ABC", "123"]), or null when it has none inside. */
export function splitPlate(plate: string): [string, string] | null {
  const at = plate.indexOf("-");
  if (at <= 0 || at === plate.length - 1) return null;
  return [plate.slice(0, at), plate.slice(at + 1)];
}
