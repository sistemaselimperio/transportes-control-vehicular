export const TRIP_STATUSES = ["programado", "en_ruta", "entregado"] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  programado: "Programado",
  en_ruta: "En ruta",
  entregado: "Entregado",
};

export function isTripStatus(value: string): value is TripStatus {
  return (TRIP_STATUSES as readonly string[]).includes(value);
}

/** A trip only moves forward (skipping is fine); keeping the same status is a no-op. */
export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return TRIP_STATUSES.indexOf(to) >= TRIP_STATUSES.indexOf(from);
}

/** What the form offers: the current status and the later ones. */
export function allowedNextStatuses(current: TripStatus): TripStatus[] {
  return TRIP_STATUSES.filter((s) => canTransition(current, s));
}
