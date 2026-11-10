export const TRIP_STATUSES = ["programado", "entregado"] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  programado: "Programado",
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

/** A trip counts as delivered this long after its start, with nobody marking it. */
export const AUTO_DELIVER_AFTER_MS = 12 * 60 * 60 * 1000;

/**
 * The status to show and act on: the stored one, or "entregado" once `AUTO_DELIVER_AFTER_MS` have
 * passed since the start. Derived at read time, so no job has to flip the stored value.
 */
export function effectiveStatus(stored: TripStatus, startAt: Date | string, now: Date): TripStatus {
  if (stored === "entregado") return "entregado";
  return now.getTime() >= new Date(startAt).getTime() + AUTO_DELIVER_AFTER_MS ? "entregado" : "programado";
}
