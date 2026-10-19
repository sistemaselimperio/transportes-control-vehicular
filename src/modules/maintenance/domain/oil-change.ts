import {
  statusFromDate,
  worstStatus,
  type AlertStatus,
  type VehicleStatus,
} from "@/modules/alerts/domain/alert-status";
import { addMonths, type IsoDate } from "@/modules/shared/domain/dates";

export type OilMode = "date" | "km" | "both";

export interface OilInterval {
  months: number | null;
  km: number | null;
}

export interface LastOilChange {
  date: IsoDate;
  km: number | null;
}

export const KM_WARNING = 500;

export function nextOilChange(input: {
  last: LastOilChange;
  interval: OilInterval;
  mode: OilMode;
}): { nextDate: IsoDate | null; nextKm: number | null } {
  const { last, interval, mode } = input;
  const useDate = mode !== "km" && interval.months != null;
  const useKm = mode !== "date" && interval.km != null && last.km != null;
  return {
    nextDate: useDate ? addMonths(last.date, interval.months!) : null,
    nextKm: useKm ? last.km! + interval.km! : null,
  };
}

export function oilChangeStatus(input: {
  vehicleStatus: VehicleStatus;
  odometerWorking: boolean;
  currentKm: number | null;
  last: LastOilChange | null;
  interval: OilInterval;
  mode: OilMode;
  today: IsoDate;
}): AlertStatus {
  if (input.vehicleStatus !== "ACTIVE") return "inactive";
  if (input.interval.months == null && input.interval.km == null) {
    return "not_applicable";
  }
  if (!input.last) return "warning"; // no oil change on record

  // A broken odometer means only the date can be used.
  const mode: OilMode = input.odometerWorking ? input.mode : "date";
  const { nextDate, nextKm } = nextOilChange({
    last: input.last,
    interval: input.interval,
    mode,
  });

  const parts: AlertStatus[] = [];
  if (nextDate) parts.push(statusFromDate(nextDate, input.today));
  if (nextKm != null && input.currentKm != null) {
    const remaining = nextKm - input.currentKm;
    parts.push(
      remaining <= 0 ? "expired" : remaining <= KM_WARNING ? "warning" : "ok",
    );
  }

  return parts.length === 0 ? "warning" : worstStatus(parts);
}
