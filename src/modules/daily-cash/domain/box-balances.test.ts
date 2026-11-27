import { describe, expect, it } from "vitest";
import { carriedFromEmptyCount, computeBoxChain, type BoxInput } from "./box-balances";

const box = (over: Partial<BoxInput> & Pick<BoxInput, "id" | "date">): BoxInput => ({
  status: "open",
  openingBalance: null,
  manualIncomeTotal: 0,
  ec1Total: 0,
  egtTotal: 0,
  countedTotal: 0,
  ...over,
});

describe("computeBoxChain", () => {
  it("is empty without boxes", () => {
    expect(computeBoxChain([])).toEqual([]);
  });

  it("opens the first box with the typed balance", () => {
    const [first] = computeBoxChain([box({ id: 1, date: "2026-11-01", openingBalance: 500000 })]);
    expect(first.openingIncome).toBe(500000);
    expect(first.carriedFromDate).toBeNull();
    expect(first.totalIncomes).toBe(500000);
  });

  it("treats a missing typed balance as zero", () => {
    const [first] = computeBoxChain([box({ id: 1, date: "2026-11-01" })]);
    expect(first.openingIncome).toBe(0);
  });

  it("adds manual incomes to TI and both companies to TE", () => {
    const [first] = computeBoxChain([
      box({ id: 1, date: "2026-11-01", openingBalance: 1000000, manualIncomeTotal: 200000, ec1Total: 300000, egtTotal: 150000 }),
    ]);
    expect(first.totalIncomes).toBe(1200000);
    expect(first.totalExpenses).toBe(450000);
    expect(first.expected).toBe(750000);
  });

  it("measures the difference as counted minus expected", () => {
    const [first] = computeBoxChain([
      box({ id: 1, date: "2026-11-01", openingBalance: 1000000, ec1Total: 300000, countedTotal: 690000 }),
    ]);
    expect(first.expected).toBe(700000);
    expect(first.difference).toBe(-10000);
  });

  it("carries the counted cash of the previous box, not the expected one", () => {
    const chain = computeBoxChain([
      box({ id: 1, date: "2026-11-01", openingBalance: 1000000, ec1Total: 300000, countedTotal: 690000 }),
      box({ id: 2, date: "2026-11-02", openingBalance: 999, ec1Total: 100000, countedTotal: 590000 }),
    ]);
    expect(chain[1].openingIncome).toBe(690000);
    expect(chain[1].carriedFromDate).toBe("2026-11-01");
    expect(chain[1].expected).toBe(590000);
    expect(chain[1].difference).toBe(0);
  });

  it("orders by date whatever the input order and ignores a typed balance on later boxes", () => {
    const chain = computeBoxChain([
      box({ id: 2, date: "2026-11-05", openingBalance: 77, countedTotal: 10 }),
      box({ id: 1, date: "2026-11-02", openingBalance: 100, countedTotal: 40 }),
    ]);
    expect(chain.map((b) => b.id)).toEqual([1, 2]);
    expect(chain[1].openingIncome).toBe(40);
  });

  it("recomputes later boxes when an earlier one changes", () => {
    const before = computeBoxChain([
      box({ id: 1, date: "2026-11-01", openingBalance: 100, countedTotal: 100 }),
      box({ id: 2, date: "2026-11-02", countedTotal: 100 }),
    ]);
    const after = computeBoxChain([
      box({ id: 1, date: "2026-11-01", openingBalance: 100, countedTotal: 60 }),
      box({ id: 2, date: "2026-11-02", countedTotal: 100 }),
    ]);
    expect(before[1].openingIncome).toBe(100);
    expect(after[1].openingIncome).toBe(60);
    expect(after[1].difference).toBe(40);
  });
});

describe("carriedFromEmptyCount", () => {
  it("warns when a later box carries zero because the previous arqueo is empty", () => {
    const chain = computeBoxChain([box({ id: 1, date: "2026-11-01", openingBalance: 100 }), box({ id: 2, date: "2026-11-02" })]);
    expect(carriedFromEmptyCount(chain[0])).toBe(false);
    expect(carriedFromEmptyCount(chain[1])).toBe(true);
  });

  it("does not warn when the previous arqueo has cash", () => {
    const chain = computeBoxChain([box({ id: 1, date: "2026-11-01", countedTotal: 50 }), box({ id: 2, date: "2026-11-02" })]);
    expect(carriedFromEmptyCount(chain[1])).toBe(false);
  });
});
