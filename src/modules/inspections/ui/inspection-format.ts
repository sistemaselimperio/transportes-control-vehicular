/** "2026-03-14" as the Colombian "14/03/2026". */
export function formatInspectionDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}
