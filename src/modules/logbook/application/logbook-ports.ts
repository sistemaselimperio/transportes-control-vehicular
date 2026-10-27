import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { ServiceKind } from "../domain/logbook";

export interface ServiceValues {
  date: IsoDate;
  kind: ServiceKind;
  description: string;
  provider: string | null;
  km: number | null;
  price: number | null;
  notes: string | null;
}

export interface TireValues {
  date: IsoDate;
  quantity: number;
  reference: string;
  provider: string | null;
  price: number | null;
  notes: string | null;
}

export interface FuelValues {
  date: IsoDate;
  gallons: number;
  amount: number;
  provider: string | null;
}

/** Oil changes are not here: they feed the alerts and live in the vehicle commands. */
export interface LogbookValues {
  service: ServiceValues;
  tire: TireValues;
  fuel: FuelValues;
}

export type EntryKind = keyof LogbookValues;

/** The lists that can be cleared in bulk: the three kinds plus the oil changes. */
export type BulkKind = EntryKind | "oil";

/** Inclusive date range; either end may be open. */
export interface DateRange {
  from: IsoDate | null;
  to: IsoDate | null;
}

/** The vehicle a record belongs to, as far as the rules need to know. */
export interface VehicleRef {
  id: number;
  status: VehicleStatus;
}

export interface LogbookRepository {
  findVehicle(plate: string): Promise<VehicleRef | null>;
  /** The vehicle of an existing record; null when the record does not exist. */
  findEntryVehicle(kind: EntryKind, id: number): Promise<VehicleRef | null>;
  create<K extends EntryKind>(kind: K, vehicleId: number, values: LogbookValues[K]): Promise<void>;
  update<K extends EntryKind>(kind: K, id: number, values: LogbookValues[K]): Promise<void>;
  remove(kind: EntryKind, id: number): Promise<void>;
  /**
   * Deletes, in one transaction, the vehicle's records of a kind inside the range and returns how
   * many went. Oil changes take their supplies with them, as deleting them one by one does.
   */
  removeMany(kind: BulkKind, vehicleId: number, range: DateRange): Promise<number>;
}
