import { canTransition, effectiveStatus, type TripStatus } from "../domain/trip-status";
import type { TripInput } from "./trip-schemas";

/** A rule of the trips refused the operation; the message is for the user. */
export class TripError extends Error {}

export interface TripValues extends TripInput {
  vehicleId: number | null;
}

export interface TripPorts {
  /** A fleet vehicle that can still travel, by normalized plate. */
  findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null>;
  findTrip(
    id: number,
  ): Promise<{ id: number; plate: string; vehicleId: number | null; status: TripStatus; startAt: Date } | null>;
  insertTrip(values: TripValues): Promise<void>;
  /** False when no trip has that id, or its STORED status is no longer `expectedStatus` (a concurrent edit). */
  updateTrip(id: number, expectedStatus: TripStatus, values: TripValues): Promise<boolean>;
  /** False when no trip has that id. */
  deleteTrip(id: number): Promise<boolean>;
}

const GONE = "El viaje ya no existe.";
const NOT_IN_FLEET = "Elige una placa de la flota.";
const CHANGED = "El viaje cambió o se eliminó mientras lo editabas. Recarga e intenta de nuevo.";

export function createTripCommands(ports: TripPorts, now: () => Date = () => new Date()) {
  /** Saved as delivered once 12 hours passed since the start, even if nobody marked it. */
  const settle = (input: TripInput): TripInput => ({
    ...input,
    status: effectiveStatus(input.status, input.startAt, now()),
  });

  return {
    async create(input: TripInput) {
      const vehicle = await ports.findVehicleByPlate(input.plate);
      if (!vehicle) throw new TripError(NOT_IN_FLEET);
      await ports.insertTrip({ ...settle(input), plate: vehicle.plate, vehicleId: vehicle.id });
    },

    async update(id: number, input: TripInput) {
      const trip = await ports.findTrip(id);
      if (!trip) throw new TripError(GONE);
      // The shown status may be the derived one: a trip stored as programado can already be delivered.
      if (!canTransition(effectiveStatus(trip.status, trip.startAt, now()), input.status)) {
        throw new TripError("El estado de un viaje solo avanza: no se puede volver a un estado anterior.");
      }
      const vehicle = await ports.findVehicleByPlate(input.plate);
      let values: TripValues;
      if (vehicle) {
        values = { ...settle(input), plate: vehicle.plate, vehicleId: vehicle.id };
      } else if (trip.plate === input.plate) {
        // The vehicle was deleted (or sold since): the trip keeps the plate and link it was saved with.
        values = { ...settle(input), vehicleId: trip.vehicleId };
      } else {
        throw new TripError(NOT_IN_FLEET);
      }
      // Guarding on the stored status we read keeps two simultaneous saves from moving a trip backward.
      if (!(await ports.updateTrip(id, trip.status, values))) throw new TripError(CHANGED);
    },

    async remove(id: number) {
      if (!(await ports.deleteTrip(id))) throw new TripError(GONE);
    },
  };
}
