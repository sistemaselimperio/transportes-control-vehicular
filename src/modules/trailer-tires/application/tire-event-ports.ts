import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { TireEventValues } from "../domain/tire-events";

/** The vehicle an event belongs to, as far as the rules need to know. */
export interface TrailerRef {
  id: number;
  status: VehicleStatus;
  isTrailer: boolean;
}

export interface TireEventRepository {
  findVehicle(plate: string): Promise<TrailerRef | null>;
  /** The vehicle of an existing event; null when the event does not exist. */
  findEventVehicle(id: number): Promise<TrailerRef | null>;
  create(vehicleId: number, values: TireEventValues): Promise<void>;
  update(id: number, values: TireEventValues): Promise<void>;
  remove(id: number): Promise<void>;
}
