export const TRIP_AREAS = [
  "Traslados",
  "Cemento",
  "Ganadería",
  "Ruta Ricaurte",
  "Abono",
  "Concentrado",
  "Combustible",
  "Trasolicar",
] as const;

export type TripArea = (typeof TRIP_AREAS)[number];

export function isTripArea(value: string): value is TripArea {
  return (TRIP_AREAS as readonly string[]).includes(value);
}
