import type { IsoDate } from "@/modules/shared/domain/dates";
import type { BoxFigures } from "./box-balances";
import type { Company } from "./voucher-import";

export interface EntryRow {
  id: number;
  kind: "expense" | "income";
  /** Null for an income. */
  company: Company | null;
  /** Null for a manual entry. */
  voucherNumber: string | null;
  detail: string;
  value: number;
  source: "import" | "manual";
}

/** One box as the detail screen shows it. */
export interface BoxSheet {
  figures: BoxFigures;
  /** The earliest box: the only one whose opening balance is typed by hand. */
  isFirst: boolean;
  /** The typed opening balance (meaningful for the first box only). */
  openingBalance: number | null;
  /** Date of the previous box when it is still open, which blocks closing this one; null otherwise. */
  closeBlockedBy: IsoDate | null;
  entries: EntryRow[];
  /** Quantity counted per denomination. */
  counts: Record<number, number>;
}
