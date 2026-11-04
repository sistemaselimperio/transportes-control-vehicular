import { bogotaDateTime } from "../domain/preoperational-inspection";

/** "2026-03-14" as the Colombian "14/03/2026". */
export function formatInspectionDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

/** "2026-03-14" as "14 / 03 / 2026", the spaced boxes of the paper form. */
export function formatSheetDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day} / ${month} / ${year}` : isoDate;
}

/** "06:30" as "06 : 30". */
export function formatSheetTime(time: string): string {
  const [hours, minutes] = time.split(":");
  return hours && minutes ? `${hours} : ${minutes}` : time;
}

/** An instant as "14/03/2026 08:05" in Colombia time. */
export function formatBogotaDateTime(instant: Date): string {
  const { date, time } = bogotaDateTime(instant);
  return `${formatInspectionDate(date)} ${time}`;
}

/** An instant as "14/03/2026" in Colombia time. */
export function formatBogotaDate(instant: Date): string {
  return formatInspectionDate(bogotaDateTime(instant).date);
}

/** "Rocío · 14/03/2026 08:05": who signed with their account and when. */
export function formatSignoff(name: string | null, at: Date | null, dateOnly = false): string {
  const when = at ? (dateOnly ? formatBogotaDate(at) : formatBogotaDateTime(at)) : "";
  return [name, when].filter(Boolean).join(" · ");
}
