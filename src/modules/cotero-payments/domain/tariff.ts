/** Tariffs per ton with history, and what a receipt should be worth under the tariff of its day. */

export interface Tariff {
  /** First day the price applies (ISO date). */
  validFrom: string;
  /** Whole pesos per ton. */
  pricePerTon: number;
}

/** The tariff in force on `date`: the latest one that started on or before it; null when none had. */
export function tariffInForce<T extends Tariff>(tariffs: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const tariff of tariffs) {
    if (tariff.validFrom <= date && (best === null || tariff.validFrom > best.validFrom)) best = tariff;
  }
  return best;
}

/** Tons times the price, in whole pesos. */
export function expectedAmount(tons: number, pricePerTon: number): number {
  return Math.round(tons * pricePerTon);
}

/** A written amount may differ from the expected one by up to this many pesos... */
export const AMOUNT_TOLERANCE_PESOS = 1000;
/** ...or by this share of the expected amount, whichever is larger. */
export const AMOUNT_TOLERANCE_RATIO = 0.01;

/** True when the written amount is further from the expected one than the tolerance allows. */
export function hasAmountMismatch(amount: number, expected: number): boolean {
  const tolerance = Math.max(AMOUNT_TOLERANCE_PESOS, Math.round(expected * AMOUNT_TOLERANCE_RATIO));
  return Math.abs(amount - expected) > tolerance;
}

export interface ReceiptFigures {
  tariffPerTon: number | null;
  expectedAmount: number | null;
  amountMismatch: boolean;
}

/** The tariff snapshot of a receipt: what it should be worth and whether the written amount agrees. */
export function receiptFigures(
  receipt: { date: string; tons: number; amount: number },
  tariffs: readonly Tariff[],
): ReceiptFigures {
  const tariff = tariffInForce(tariffs, receipt.date);
  if (tariff === null) return { tariffPerTon: null, expectedAmount: null, amountMismatch: false };
  const expected = expectedAmount(receipt.tons, tariff.pricePerTon);
  return {
    tariffPerTon: tariff.pricePerTon,
    expectedAmount: expected,
    amountMismatch: hasAmountMismatch(receipt.amount, expected),
  };
}
