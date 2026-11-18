/** Rules of the office "Parte diario" page: one row per plate, the latest report of the chosen date. */
import { normalizePlateKey } from "./inspection-links";
import { isIsoDate } from "./preoperational-inspection";

/** An inspection of the date with what the page needs, plus `createdAt` to pick the latest one. */
export type DailyReportCandidate = {
  id: string;
  createdAt: Date;
  plate: string;
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
    .map(([, { id, plate, trailerPlate, driverName, odometer, restHours, route, location, fuel, pendingMaintenance }]) => ({
      id,
      plate,
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
