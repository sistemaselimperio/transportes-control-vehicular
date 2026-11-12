import type { IsoDate } from "@/modules/shared/domain/dates";

const MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
] as const;

/** The date as the sheet writes it: "NOVIEMBRE 7 2026". */
export function formatSheetDate(iso: IsoDate): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d} ${y}`;
}

/** The date as a screen title: "Noviembre 7, 2026". */
export function formatLedgerTitle(iso: IsoDate): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[m - 1];
  return `${month.charAt(0)}${month.slice(1).toLowerCase()} ${d}, ${y}`;
}
