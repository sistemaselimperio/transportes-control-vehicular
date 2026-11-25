/** The wording and lines of the settlement sheet ("LIQUIDACIÓN DE CARGUE Y DESCARGUE"). */

const MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
] as const;

/** "11 DE NOVIEMBRE". */
export function formatSheetDay(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} DE ${MONTHS[month - 1]}`;
}

export interface SheetLine {
  day: string;
  tons: number;
  unitPrice: number;
  /** What the receipt says: the amount that gets paid. */
  total: number;
}

/** One line per receipt; without a tariff snapshot the unit price is what the written amount implies. */
export function settlementSheetLines(
  receipts: ReadonlyArray<{ date: string; tons: number; tariffPerTon: number | null; amount: number }>,
): SheetLine[] {
  return receipts.map((r) => ({
    day: formatSheetDay(r.date),
    tons: r.tons,
    unitPrice: r.tariffPerTon ?? Math.round(r.amount / r.tons),
    total: r.amount,
  }));
}
