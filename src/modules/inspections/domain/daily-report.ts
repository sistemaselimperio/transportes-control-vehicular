/** Rules of the office "Parte diario" page: one row per plate, the latest report of the chosen date. */
import { normalizePlateKey } from "./inspection-links";
import { isIsoDate } from "./preoperational-inspection";

/**
 * The page only shows reports registered from this moment on (18 Nov 2026, 3 p.m. Bogotá): the
 * daily-report data saved before it is incomplete.
 */
export const DAILY_REPORT_STARTS_AT = new Date("2026-11-18T15:00:00-05:00");

/** Whether an inspection saved at `createdAt` carries a usable daily report. */
export function countsForDailyReport(createdAt: Date): boolean {
  return createdAt.getTime() >= DAILY_REPORT_STARTS_AT.getTime();
}

/** The first date the page can show, in YYYY-MM-DD (Bogotá). */
export const DAILY_REPORT_FIRST_DATE = "2026-11-18";

/** An inspection of the date with what the page needs, plus `createdAt` to pick the latest one. */
export type DailyReportCandidate = {
  id: string;
  createdAt: Date;
  plate: string;
  /** Plate of the registered vehicle the inspection is linked to, null when the typed plate matched none. */
  vehiclePlate: string | null;
  trailerPlate: string | null;
  driverName: string;
  odometer: string;
  /** The daily-report fields are null on rows saved before the "Parte diario" tab existed. */
  restHours: string | null;
  route: string;
  location: string | null;
  fuel: string | null;
  pendingMaintenance: string | null;
};

export type DailyReportRow = Omit<DailyReportCandidate, "createdAt">;

/** The latest submission of each plate (by `createdAt`), ordered by plate. */
export function latestPerPlate(rows: readonly DailyReportCandidate[]): DailyReportRow[] {
  const latest = new Map<string, DailyReportCandidate>();
  for (const candidate of rows) {
    const key = normalizePlateKey(candidate.plate);
    const current = latest.get(key);
    if (!current || candidate.createdAt.getTime() > current.createdAt.getTime()) latest.set(key, candidate);
  }
  return [...latest.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, { id, plate, vehiclePlate, trailerPlate, driverName, odometer, restHours, route, location, fuel, pendingMaintenance }]) => ({
      id,
      plate,
      vehiclePlate,
      trailerPlate,
      driverName,
      odometer,
      restHours,
      route,
      location,
      fuel,
      pendingMaintenance,
    }));
}

/** The `fecha` query value when it is a real YYYY-MM-DD date, else `today`. */
export function parseDailyReportDate(param: string | string[] | undefined, today: string): string {
  const value = (Array.isArray(param) ? param[0] : param)?.trim() ?? "";
  return isIsoDate(value) ? value : today;
}
