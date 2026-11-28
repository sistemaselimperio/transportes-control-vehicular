/**
 * Vehicle classes used only inside the company: motorcycles, trailers and machines. They are never
 * dispatched on their own, so the plate pickers of deliveries and loads leave them out. The
 * public pre-operational form still lists them, because they are inspected too.
 */
export const INTERNAL_CLASS_NAMES = [
  "Motocicleta",
  "Motocarro",
  "Remolque",
  "Montacargas",
  "Cargador",
  "Equipo",
] as const;

const classKey = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const INTERNAL_KEYS = new Set(INTERNAL_CLASS_NAMES.map(classKey));

export function isInternalClass(className: string): boolean {
  return INTERNAL_KEYS.has(classKey(className));
}
