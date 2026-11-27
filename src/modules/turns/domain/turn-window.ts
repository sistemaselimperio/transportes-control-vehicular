/** Wall-clock times of a jornada. Colombia has no daylight saving, so Bogotá is a fixed UTC-5. */
import type { IsoDate } from "@/modules/shared/domain/dates";

const BOGOTA_OFFSET_HOURS = 5;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Whether the text is a valid "HH:mm" time of day. */
export function isTimeOfDay(value: string): boolean {
  return TIME.test(value);
}

/** The instant of a Bogotá calendar day at an "HH:mm" wall-clock time. */
export function bogotaInstant(date: IsoDate, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + BOGOTA_OFFSET_HOURS, mm));
}

/** "HH:mm" in Bogotá of an instant (24-hour). */
export function formatBogotaTime(instant: Date): string {
  const shifted = new Date(instant.getTime() - BOGOTA_OFFSET_HOURS * 3_600_000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

/** 12-hour label for the screen: "7:30 a. m.". */
export function formatBogotaClock(instant: Date): string {
  const shifted = new Date(instant.getTime() - BOGOTA_OFFSET_HOURS * 3_600_000);
  const h = shifted.getUTCHours();
  const m = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "a. m." : "p. m."}`;
}
