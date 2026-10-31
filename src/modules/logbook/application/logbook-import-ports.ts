import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { VehicleTechnicalData } from "@/modules/vehicles/domain/technical-data";
import type { ExistingRecords } from "../domain/logbook-import";
import type { ServiceValues } from "./logbook-ports";

/** What the import needs to know about the vehicle it fills. */
export interface ImportVehicle {
  id: number;
  status: VehicleStatus;
}

/** Everything one confirmed import writes. */
export interface ImportWrite {
  services: ServiceValues[];
  /** Technical fields to fill; the repository only sets the ones still empty. */
  technical: Partial<VehicleTechnicalData>;
}

export interface LogbookImportRepository {
  findVehicle(plate: string): Promise<ImportVehicle | null>;
  loadExisting(vehicleId: number): Promise<ExistingRecords>;
  /** All-or-nothing: either every record is stored or none. */
  apply(vehicleId: number, write: ImportWrite): Promise<void>;
}
