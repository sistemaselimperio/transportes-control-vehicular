/**
 * Business rules for the vehicle actions (transfer, sale, status, driver, km).
 * Pure: each guard throws a `RuleError` whose message is end-user copy (Spanish).
 */
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";
import { formatKm } from "./vehicle-row";

/** A violated business rule; safe to show to the operator as-is. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

export function assertEditable(status: VehicleStatus): void {
  if (status === "SOLD") {
    throw new RuleError("Este vehículo ya fue vendido y no admite cambios.");
  }
}

export function assertNotFuture(date: IsoDate, today: IsoDate): void {
  if (date > today) {
    throw new RuleError(
      `La fecha no puede ser futura (hoy es ${formatDisplayDate(today)}).`,
    );
  }
}

export function assertKmNotDecreasing(currentKm: number | null, nextKm: number): void {
  if (currentKm != null && nextKm < currentKm) {
    throw new RuleError(
      `El kilometraje no puede ser menor al actual (${formatKm(currentKm)} km).`,
    );
  }
}

export function assertCanChangeStatus(current: VehicleStatus, target: VehicleStatus): void {
  assertEditable(current);
  if (target === "SOLD") {
    throw new RuleError("Para marcar un vehículo como vendido usa la opción Vender.");
  }
  if (current === target) {
    throw new RuleError("El vehículo ya tiene ese estado.");
  }
}

export function assertCanTransfer(input: {
  status: VehicleStatus;
  currentOwnerId: number | null;
  targetOwnerId: number | null;
  date: IsoDate;
  today: IsoDate;
}): void {
  assertEditable(input.status);
  assertNotFuture(input.date, input.today);
  if (input.targetOwnerId != null && input.targetOwnerId === input.currentOwnerId) {
    throw new RuleError("El vehículo ya pertenece a ese propietario.");
  }
}

export function assertCanSell(input: {
  status: VehicleStatus;
  date: IsoDate;
  today: IsoDate;
}): void {
  assertEditable(input.status);
  assertNotFuture(input.date, input.today);
}

export function assertCanAssignDriver(input: {
  status: VehicleStatus;
  currentDriverId: number | null;
  targetDriverId: number | null;
  date: IsoDate;
  today: IsoDate;
}): void {
  assertEditable(input.status);
  assertNotFuture(input.date, input.today);
  if (input.targetDriverId != null && input.targetDriverId === input.currentDriverId) {
    throw new RuleError("Ese conductor ya está asignado al vehículo.");
  }
}

/**
 * Dates for closing an open ownership/assignment. Imported rows start on the
 * import day (a placeholder), so a back-dated close pulls the start back too,
 * keeping `from <= to`.
 */
export function closePeriod(
  fromDate: IsoDate,
  closeDate: IsoDate,
): { fromDate: IsoDate; toDate: IsoDate } {
  return { fromDate: fromDate < closeDate ? fromDate : closeDate, toDate: closeDate };
}
