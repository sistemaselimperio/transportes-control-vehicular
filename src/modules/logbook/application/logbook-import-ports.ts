import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { OilMode } from "@/modules/maintenance/domain/oil-change";
import type { OilItem } from "@/modules/maintenance/domain/oil-items";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { VehicleTechnicalData } from "@/modules/vehicles/domain/technical-data";
import type { ExistingRecords } from "../domain/logbook-import";
import type { FuelValues, ServiceValues, TireValues } from "./logbook-ports";

/** What the import needs to know about the vehicle it fills. */
export interface ImportVehicle {
  id: number;
  status: VehicleStatus;
  odometerWorking: boolean;
  currentKm: number | null;
  oilMode: OilMode;
  /** Interval of the latest oil change, else the class default: the one the oil form proposes. */
  oilInterval: { months: number | null; km: number | null };
}

/** An oil change with its next change already computed, as the "Cambio de aceite" button stores it. */
export interface PlannedOilChange {
  date: IsoDate;
  km: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  nextDate: IsoDate | null;
  nextKm: number | null;
  price: number | null;
  notes: string | null;
  items: OilItem[];
}

/** Everything one confirmed import writes. */
export interface ImportWrite {
  services: ServiceValues[];
  tires: TireValues[];
  fuels: FuelValues[];
  /** Oldest first. */
  oils: PlannedOilChange[];
  /** The vehicle's odometer reading when the oil changes raise it. */
  newCurrentKm: { km: number; at: IsoDate } | null;
  /** Technical fields to fill; the repository only sets the ones still empty. */
  technical: Partial<VehicleTechnicalData>;
}

export interface LogbookImportRepository {
  findVehicle(plate: string): Promise<ImportVehicle | null>;
  loadExisting(vehicleId: number): Promise<ExistingRecords>;
  /** All-or-nothing: either every record is stored or none. */
  apply(vehicleId: number, write: ImportWrite): Promise<void>;
}
