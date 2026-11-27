/** The receipts of a list grouped per cotero, with what each person is owed, for the cotero list of the page. */
import { groupByCotero } from "./cotero-identity";
import { totalsOfReceipts, type ReceiptRow } from "./receipt-rules";

export interface CoteroSummary {
  key: string;
  name: string;
  document: string | null;
  /** Their receipts, newest first. */
  receipts: ReceiptRow[];
  count: number;
  /** Day of the most recent receipt. */
  lastDate: string;
  /** What is still to be settled: the receipts in "pending". */
  pending: { count: number; tons: number; amount: number };
  all: { count: number; tons: number; amount: number };
}

const newestFirst = (a: ReceiptRow, b: ReceiptRow) => b.date.localeCompare(a.date) || b.id - a.id;

/** One summary per cotero, the one with the most recent receipt first (ties by name). */
export function summarizeCoteros(rows: readonly ReceiptRow[]): CoteroSummary[] {
  return groupByCotero(rows)
    .map((group) => {
      const receipts = [...group.items].sort(newestFirst);
      return {
        key: group.key,
        name: group.name,
        document: group.document,
        receipts,
        count: receipts.length,
        lastDate: receipts[0].date,
        pending: totalsOfReceipts(receipts.filter((r) => r.status === "pending")),
        all: totalsOfReceipts(receipts),
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, "es"));
}
