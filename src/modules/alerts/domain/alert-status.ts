import { daysBetween, type IsoDate } from "@/modules/shared/domain/dates";

export type AlertStatus =
  | "expired"
  | "warning"
  | "ok"
  | "not_applicable"
  | "inactive";

export type VehicleStatus = "ACTIVE" | "IDLE" | "IN_WORKSHOP" | "SOLD";

export const WARNING_DAYS = 30;

const SEVERITY: Record<AlertStatus, number> = {
  expired: 4,
  warning: 3,
  ok: 2,
  not_applicable: 1,
  inactive: 0,
};

/** Status of a date-based thing (document, oil change date) given the days left. */
export function statusFromDate(expiresOn: IsoDate, today: IsoDate): AlertStatus {
  const daysLeft = daysBetween(today, expiresOn);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= WARNING_DAYS) return "warning";
  return "ok";
}

export function documentStatus(input: {
  expiresOn: IsoDate | null;
  notApplicable?: boolean;
  today: IsoDate;
}): AlertStatus {
  if (input.notApplicable) return "not_applicable";
  if (!input.expiresOn) return "warning"; // applicable but no data on record
  return statusFromDate(input.expiresOn, input.today);
}

export function worstStatus(statuses: readonly AlertStatus[]): AlertStatus {
  if (statuses.length === 0) return "not_applicable";
  return statuses.reduce((worst, s) =>
    SEVERITY[s] > SEVERITY[worst] ? s : worst,
  );
}

export function vehicleOverallStatus(input: {
  vehicleStatus: VehicleStatus;
  alerts: readonly AlertStatus[];
}): AlertStatus {
  if (input.vehicleStatus === "SOLD") return "inactive";
  return worstStatus(input.alerts);
}
