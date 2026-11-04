/**
 * Names typed to mean "this vehicle has no driver". They are not people: a vehicle without a driver
 * simply has no current assignment ("Sin asignar"), so these are never saved as drivers.
 */
const PLACEHOLDERS = new Set([
  "sin conductor",
  "sin vehiculo",
  "sin asignar",
  "no asignado",
  "ninguno",
  "n/a",
  "na",
]);

const fold = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function isPlaceholderDriverName(name: string): boolean {
  return PLACEHOLDERS.has(fold(name));
}

export const PLACEHOLDER_DRIVER_MESSAGE =
  "Ese no es un conductor. Si el vehículo no tiene conductor, déjalo sin asignar.";
