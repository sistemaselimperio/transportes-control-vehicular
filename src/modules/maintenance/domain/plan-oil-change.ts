import type { IsoDate } from "@/modules/shared/domain/dates";
import { assertNotFuture, RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { nextOilChange, type OilInterval, type OilMode } from "./oil-change";

export interface OilChangePlan {
  intervalMonths: number | null;
  intervalKm: number | null;
  nextDate: IsoDate | null;
  nextKm: number | null;
  /** Value for `vehicles.current_km`, or null when it must stay as is. */
  newCurrentKm: number | null;
}

/**
 * Validates a new oil change and computes its next due date/km. `interval` is
 * the class default or the operator's override; a broken odometer forces the
 * date-only mode, like the status computation does.
 */
export function planOilChange(input: {
  date: IsoDate;
  km: number | null;
  today: IsoDate;
  vehicle: { odometerWorking: boolean; currentKm: number | null; oilMode: OilMode };
  interval: OilInterval;
}): OilChangePlan {
  const { date, km, today, vehicle, interval } = input;
  assertNotFuture(date, today);
  if (vehicle.odometerWorking && km == null) {
    throw new RuleError("Ingresa el kilometraje del cambio de aceite.");
  }

  const { nextDate, nextKm } = nextOilChange({
    last: { date, km },
    interval,
    mode: vehicle.odometerWorking ? vehicle.oilMode : "date",
  });
  const raisesKm = km != null && (vehicle.currentKm == null || km > vehicle.currentKm);

  return {
    intervalMonths: interval.months,
    intervalKm: interval.km,
    nextDate,
    nextKm,
    newCurrentKm: raisesKm ? km : null,
  };
}
