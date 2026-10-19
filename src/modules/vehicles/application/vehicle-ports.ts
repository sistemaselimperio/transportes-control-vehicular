import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { OilMode } from "@/modules/maintenance/domain/oil-change";
import type { IsoDate } from "@/modules/shared/domain/dates";

/** What the command use cases need to know about a vehicle. */
export interface VehicleSnapshot {
  id: number;
  plate: string;
  status: VehicleStatus;
  odometerWorking: boolean;
  currentKm: number | null;
  oilMode: OilMode;
  /** Interval of the latest oil change, else the class default. */
  oilInterval: { months: number | null; km: number | null };
  ownership: { id: number; ownerId: number; fromDate: IsoDate } | null;
  assignment: { id: number; driverId: number; fromDate: IsoDate } | null;
}

/** Dates of an open period (ownership / assignment) being closed. */
export interface PeriodClose {
  id: number;
  fromDate: IsoDate;
  toDate: IsoDate;
}

export type OwnerTarget =
  | { kind: "existing"; id: number }
  | { kind: "imperio" }
  | { kind: "new"; name: string; documentNumber: string | null };

export type DriverTarget =
  | { kind: "existing"; id: number }
  | { kind: "new"; name: string; nationalId: string | null; phone: string | null };

export interface DocumentRecord {
  type: "SOAT" | "TECNO" | "POLICY";
  policyKind: "TR" | "RC" | null;
  expiresOn: IsoDate | null;
  notApplicable: boolean;
}

export interface TaxRecord {
  kind: "PAID_YEAR" | "EXEMPT" | "EXEMPT_LOW_DISPLACEMENT";
  year: number | null;
}

export interface OilChangeRecord {
  date: IsoDate;
  km: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  nextDate: IsoDate | null;
  nextKm: number | null;
  notes: string | null;
}

export interface SaleRecord {
  date: IsoDate;
  buyer: string | null;
  price: number | null;
  notes: string | null;
}

/**
 * Port for the vehicle commands. Every method that writes more than one row
 * must be atomic (one DB transaction) in the adapter.
 */
export interface VehicleCommandRepository {
  findByPlates(plates: string[]): Promise<VehicleSnapshot[]>;
  /** Id of an owner when it already exists (null when it would be created). */
  findOwnerId(target: OwnerTarget): Promise<number | null>;
  findDriverId(target: DriverTarget): Promise<number | null>;

  addDocument(vehicleId: number, doc: DocumentRecord): Promise<void>;
  addTax(vehicleId: number, tax: TaxRecord): Promise<void>;
  /** Inserts the oil change and, when `newCurrentKm` is set, updates the vehicle km. */
  addOilChange(
    vehicleId: number,
    oil: OilChangeRecord,
    newCurrentKm: number | null,
  ): Promise<void>;
  /** `reading` null leaves the stored km untouched. */
  updateOdometer(
    vehicleId: number,
    odometer: { odometerWorking: boolean; reading: { km: number; at: IsoDate } | null },
  ): Promise<void>;
  setStatus(vehicleId: number, status: VehicleStatus): Promise<void>;
  /** Closes the current assignment and opens the new one. */
  assignDriver(input: {
    vehicleId: number;
    driver: DriverTarget;
    date: IsoDate;
    close: PeriodClose | null;
  }): Promise<void>;
  /** Closes the current ownership and opens the new one. */
  transferOwnership(input: {
    vehicleId: number;
    owner: OwnerTarget;
    date: IsoDate;
    close: PeriodClose | null;
  }): Promise<void>;
  /** Inserts the sale, marks the vehicle SOLD and closes ownership and driver. */
  registerSale(input: {
    vehicleId: number;
    sale: SaleRecord;
    closeOwnership: PeriodClose | null;
    closeAssignment: PeriodClose | null;
  }): Promise<void>;
}
