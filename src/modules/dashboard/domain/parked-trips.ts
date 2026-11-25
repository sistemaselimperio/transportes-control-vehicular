/**
 * Warning for a trip programmed on a vehicle that is parked (idle or in the workshop). Pure and
 * derived at read time from the current trips and vehicle statuses: nothing is stored, and the
 * warning disappears by itself once the vehicle is set back to active. The app never changes a
 * vehicle's status on its own.
 */
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import { effectiveStatus, type TripStatus } from "@/modules/trips/domain/trip-status";
import type { OwnerGroup } from "./dashboard-metrics";

export interface ParkedTripInput {
  id: number;
  /** ISO instant. */
  startAt: string;
  origin: string | null;
  destination: string;
  /** Plate as saved with the trip. */
  plate: string;
  /** Null for a trip without a fleet vehicle. */
  vehicleId: number | null;
  status: TripStatus;
}

export interface ParkedTripVehicle {
  id: number;
  plate: string;
  status: VehicleStatus;
  ownerGroup: OwnerGroup | null;
}

export interface ParkedTripWarning {
  tripId: number;
  vehicleId: number;
  /** The vehicle's current plate. */
  plate: string;
  startAt: string;
  origin: string | null;
  destination: string;
  vehicleStatus: "IDLE" | "IN_WORKSHOP";
  ownerGroup: OwnerGroup | null;
}

/** Programmed trips of parked fleet vehicles, the soonest first. `now` decides which trips count as already delivered. */
export function parkedTripWarnings(
  trips: readonly ParkedTripInput[],
  vehicles: readonly ParkedTripVehicle[],
  now: Date,
): ParkedTripWarning[] {
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const out: ParkedTripWarning[] = [];
  for (const trip of trips) {
    if (trip.vehicleId == null) continue;
    if (effectiveStatus(trip.status, trip.startAt, now) !== "programado") continue;
    const vehicle = byId.get(trip.vehicleId);
    if (!vehicle || (vehicle.status !== "IDLE" && vehicle.status !== "IN_WORKSHOP")) continue;
    out.push({
      tripId: trip.id,
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      startAt: trip.startAt,
      origin: trip.origin,
      destination: trip.destination,
      vehicleStatus: vehicle.status,
      ownerGroup: vehicle.ownerGroup,
    });
  }
  return out.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.tripId - b.tripId);
}

/** The sidebar badge counts (fleet-wide and per owner group) plus one for each warned vehicle. */
export function addParkedTripCounts(
  counts: Record<OwnerGroup | "ALL", number>,
  warnings: readonly ParkedTripWarning[],
): Record<OwnerGroup | "ALL", number> {
  const next = { ...counts };
  const seen = new Set<number>();
  for (const w of warnings) {
    if (seen.has(w.vehicleId)) continue;
    seen.add(w.vehicleId);
    next.ALL += 1;
    if (w.ownerGroup) next[w.ownerGroup] += 1;
  }
  return next;
}
