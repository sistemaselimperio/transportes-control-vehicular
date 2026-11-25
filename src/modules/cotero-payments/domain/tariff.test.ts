import { describe, expect, it } from "vitest";
import { AMOUNT_TOLERANCE_PESOS, expectedAmount, hasAmountMismatch, receiptFigures, tariffInForce } from "./tariff";

const TARIFFS = [
  { validFrom: "2026-01-01", pricePerTon: 9800 },
  { validFrom: "2026-07-01", pricePerTon: 10500 },
  { validFrom: "2026-04-01", pricePerTon: 10000 },
];

describe("tariffInForce", () => {
  it("is the latest tariff that started on or before the date", () => {
    expect(tariffInForce(TARIFFS, "2026-03-31")?.pricePerTon).toBe(9800);
    expect(tariffInForce(TARIFFS, "2026-04-01")?.pricePerTon).toBe(10000);
    expect(tariffInForce(TARIFFS, "2026-06-30")?.pricePerTon).toBe(10000);
    expect(tariffInForce(TARIFFS, "2026-07-01")?.pricePerTon).toBe(10500);
    expect(tariffInForce(TARIFFS, "2030-01-01")?.pricePerTon).toBe(10500);
  });

  it("is null before the first tariff and without tariffs", () => {
    expect(tariffInForce(TARIFFS, "2025-12-31")).toBeNull();
    expect(tariffInForce([], "2026-01-01")).toBeNull();
  });

  it("does not depend on the order of the list", () => {
    expect(tariffInForce([...TARIFFS].reverse(), "2026-05-01")?.pricePerTon).toBe(10000);
  });
});

describe("expectedAmount", () => {
  it("is the tons times the price, in whole pesos", () => {
    expect(expectedAmount(33.213, 9800)).toBe(325487);
    expect(expectedAmount(12.88, 9800)).toBe(126224);
    expect(expectedAmount(10, 9800)).toBe(98000);
  });
});

describe("hasAmountMismatch", () => {
  it("accepts rounding differences", () => {
    expect(hasAmountMismatch(325498, 325487)).toBe(false);
    expect(hasAmountMismatch(126224, 126224)).toBe(false);
  });

  it("tolerates up to $1.000 or 1% of the expected amount, whichever is larger", () => {
    expect(hasAmountMismatch(100000 + AMOUNT_TOLERANCE_PESOS, 100000)).toBe(false);
    expect(hasAmountMismatch(100000 + AMOUNT_TOLERANCE_PESOS + 1, 100000)).toBe(true);
    // 1% of 500.000 is 5.000, larger than the flat tolerance.
    expect(hasAmountMismatch(505000, 500000)).toBe(false);
    expect(hasAmountMismatch(505001, 500000)).toBe(true);
  });

  it("flags a lower amount just like a higher one", () => {
    expect(hasAmountMismatch(90000, 100000)).toBe(true);
  });
});

describe("receiptFigures", () => {
  it("snapshots the tariff of the receipt date and flags a mismatch", () => {
    expect(receiptFigures({ date: "2026-05-02", tons: 33.213, amount: 325498 }, TARIFFS)).toEqual({
      tariffPerTon: 10000,
      expectedAmount: 332130,
      amountMismatch: true,
    });
    expect(receiptFigures({ date: "2026-02-02", tons: 33.213, amount: 325498 }, TARIFFS)).toEqual({
      tariffPerTon: 9800,
      expectedAmount: 325487,
      amountMismatch: false,
    });
  });

  it("has no expectation, and no mismatch, without a tariff in force", () => {
    expect(receiptFigures({ date: "2025-01-01", tons: 10, amount: 1 }, TARIFFS)).toEqual({
      tariffPerTon: null,
      expectedAmount: null,
      amountMismatch: false,
    });
  });
});
