import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import { sortTrips, type TripRow } from "../domain/trip-row";
import { loadTripRows, loadVehicleTrips } from "../infrastructure/trip-repository";

/** Every trip, newest start first; company-wide, filtered on the client. */
export async function listTripRows(): Promise<TripRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("tripRows"));

  return sortTrips(await loadTripRows());
}

/** The latest `limit` trips of one vehicle for its file, newest start first. */
export async function listVehicleTrips(vehicleId: number, limit: number): Promise<TripRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("vehicleTrips"));

  return loadVehicleTrips(vehicleId, limit);
}
