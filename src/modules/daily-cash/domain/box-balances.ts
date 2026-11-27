import type { IsoDate } from "@/modules/shared/domain/dates";
import type { BoxStatus } from "./box-rules";

/** What the chain needs from a box; everything else is derived. */
export interface BoxInput {
  id: number;
  date: IsoDate;
  status: BoxStatus;
  /** Typed by hand; only the earliest box uses it. */
  openingBalance: number | null;
  /** Sum of the manual incomes. */
  manualIncomeTotal: number;
  ec1Total: number;
  egtTotal: number;
  /** Cash counted in the arqueo. */
  countedTotal: number;
}

export interface BoxFigures {
  id: number;
  date: IsoDate;
  status: BoxStatus;
  /** "Saldo caja del <carriedFromDate>": the previous box's counted cash, or the typed balance of the first box. */
  openingIncome: number;
  /** Date of the box the opening income comes from; null for the first box. */
  carriedFromDate: IsoDate | null;
  manualIncomeTotal: number;
  /** TI: opening income plus manual incomes. */
  totalIncomes: number;
  ec1Total: number;
  egtTotal: number;
  /** TE: both companies. */
  totalExpenses: number;
  /** TI - TE: the cash the box should hold. */
  expected: number;
  /** Saldo actual caja: what was counted. */
  counted: number;
  /** Counted minus expected; anything but zero is a mismatch. */
  difference: number;
}

/** A later box that opens with 0 because the previous box has no arqueo counted: worth a warning. */
export function carriedFromEmptyCount(figures: Pick<BoxFigures, "carriedFromDate" | "openingIncome">): boolean {
  return figures.carriedFromDate !== null && figures.openingIncome === 0;
}

/**
 * Figures of every box in chronological order. Only the first opening balance is stored; each later
 * box opens with the previous one's counted cash, so editing an older box changes every later one
 * with no stored figure to fix.
 */
export function computeBoxChain(boxes: ReadonlyArray<BoxInput>): BoxFigures[] {
  const sorted = [...boxes].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let carried: { amount: number; date: IsoDate } | null = null;
  return sorted.map((b) => {
    const openingIncome = carried ? carried.amount : (b.openingBalance ?? 0);
    const totalIncomes = openingIncome + b.manualIncomeTotal;
    const totalExpenses = b.ec1Total + b.egtTotal;
    const expected = totalIncomes - totalExpenses;
    const figures: BoxFigures = {
      id: b.id,
      date: b.date,
      status: b.status,
      openingIncome,
      carriedFromDate: carried ? carried.date : null,
      manualIncomeTotal: b.manualIncomeTotal,
      totalIncomes,
      ec1Total: b.ec1Total,
      egtTotal: b.egtTotal,
      totalExpenses,
      expected,
      counted: b.countedTotal,
      difference: b.countedTotal - expected,
    };
    carried = { amount: b.countedTotal, date: b.date };
    return figures;
  });
}
