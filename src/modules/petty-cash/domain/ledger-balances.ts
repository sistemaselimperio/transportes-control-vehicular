import type { IsoDate } from "@/modules/shared/domain/dates";

/** What the chain needs from a ledger; everything else is derived. */
export interface LedgerInput {
  id: number;
  /** The user's own consecutive ledger number: permanent, shown as "Planilla N" and used in the URL. */
  number: number;
  date: IsoDate;
  compenseAmount: number;
  expensesTotal: number;
}

export interface LedgerBalance {
  id: number;
  number: number;
  date: IsoDate;
  openingBalance: number;
  compenseAmount: number;
  total: number;
  totalExpenses: number;
  closingBalance: number;
}

/** Chronological order: by date, then by creation (ids grow with creation). */
function byDateThenId(a: Pick<LedgerInput, "date" | "id">, b: Pick<LedgerInput, "date" | "id">) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id - b.id;
}

/** The id of the earliest ledger: the only one whose opening balance is typed by hand. */
export function firstLedgerId(ledgers: ReadonlyArray<Pick<LedgerInput, "date" | "id">>): number | null {
  const sorted = [...ledgers].sort(byDateThenId);
  return sorted.length === 0 ? null : sorted[0].id;
}

/**
 * Balances of every ledger, in chronological order. Only the first opening balance is stored
 * (`initialBalance`); each later ledger opens with the previous one's closing balance, so editing
 * any past ledger changes every later one with no stored figure to fix.
 */
export function computeLedgerChain(initialBalance: number, ledgers: ReadonlyArray<LedgerInput>): LedgerBalance[] {
  let opening = initialBalance;
  return [...ledgers].sort(byDateThenId).map((l) => {
    const total = opening + l.compenseAmount;
    const closingBalance = total - l.expensesTotal;
    const balance: LedgerBalance = {
      id: l.id,
      number: l.number,
      date: l.date,
      openingBalance: opening,
      compenseAmount: l.compenseAmount,
      total,
      totalExpenses: l.expensesTotal,
      closingBalance,
    };
    opening = closingBalance;
    return balance;
  });
}

/**
 * Whether a ledger with this date would be the earliest of the user's ledgers. `others` are the
 * user's other ledgers; `candidate.id` is null for a ledger not created yet (it will get the
 * highest id, so on a tied date it comes after the existing ones).
 */
export function wouldBeFirst(
  others: ReadonlyArray<Pick<LedgerInput, "date" | "id">>,
  candidate: { id: number | null; date: IsoDate },
): boolean {
  const first = firstLedgerId(others);
  if (first === null) return true;
  const earliest = others.find((l) => l.id === first)!;
  if (candidate.date !== earliest.date) return candidate.date < earliest.date;
  return candidate.id !== null && candidate.id < earliest.id;
}
