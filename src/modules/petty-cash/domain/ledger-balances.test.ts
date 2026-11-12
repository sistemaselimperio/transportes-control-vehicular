import { describe, expect, it } from "vitest";
import { computeLedgerChain, firstLedgerId, wouldBeFirst, type LedgerInput } from "./ledger-balances";

const ledger = (id: number, date: string, compenseAmount: number, expensesTotal: number): LedgerInput => ({
  id,
  number: id,
  date,
  compenseAmount,
  expensesTotal,
});

describe("computeLedgerChain", () => {
  it("is empty without ledgers", () => {
    expect(computeLedgerChain(500, [])).toEqual([]);
  });

  it("computes one ledger from the manual opening balance", () => {
    const [a] = computeLedgerChain(100_000, [ledger(1, "2026-11-01", 400_000, 150_000)]);
    expect(a).toEqual({
      id: 1,
      number: 1,
      date: "2026-11-01",
      openingBalance: 100_000,
      compenseAmount: 400_000,
      total: 500_000,
      totalExpenses: 150_000,
      closingBalance: 350_000,
    });
  });

  it("opens each later ledger with the previous closing balance", () => {
    const chain = computeLedgerChain(0, [
      ledger(1, "2026-10-01", 500_000, 200_000),
      ledger(2, "2026-10-15", 300_000, 100_000),
      ledger(3, "2026-11-01", 100_000, 50_000),
    ]);
    expect(chain.map((l) => l.openingBalance)).toEqual([0, 300_000, 500_000]);
    expect(chain.map((l) => l.closingBalance)).toEqual([300_000, 500_000, 550_000]);
  });

  it("sorts by date, then by creation (id)", () => {
    const chain = computeLedgerChain(0, [
      ledger(3, "2026-11-01", 10, 0),
      ledger(2, "2026-11-01", 10, 0),
      ledger(1, "2026-12-01", 10, 0),
    ]);
    expect(chain.map((l) => l.id)).toEqual([2, 3, 1]);
    expect(chain.map((l) => l.openingBalance)).toEqual([0, 10, 20]);
  });

  it("lets the balance go negative and carries it forward", () => {
    const chain = computeLedgerChain(0, [ledger(1, "2026-11-01", 100, 300), ledger(2, "2026-11-02", 50, 0)]);
    expect(chain[0].closingBalance).toBe(-200);
    expect(chain[1].openingBalance).toBe(-200);
    expect(chain[1].closingBalance).toBe(-150);
  });

  it("recalculates every later ledger when a past one changes", () => {
    const before = computeLedgerChain(0, [ledger(1, "2026-10-01", 100, 40), ledger(2, "2026-10-10", 100, 40)]);
    const after = computeLedgerChain(0, [ledger(1, "2026-10-01", 100, 90), ledger(2, "2026-10-10", 100, 40)]);
    expect(before[1].closingBalance).toBe(120);
    expect(after[1].closingBalance).toBe(70);
  });

  it("changes the whole chain when the initial balance changes", () => {
    const chain = computeLedgerChain(1_000, [ledger(1, "2026-10-01", 0, 0), ledger(2, "2026-10-02", 0, 0)]);
    expect(chain.map((l) => l.closingBalance)).toEqual([1_000, 1_000]);
  });

  it("does not mutate its input", () => {
    const input = [ledger(2, "2026-11-02", 1, 0), ledger(1, "2026-11-01", 1, 0)];
    computeLedgerChain(0, input);
    expect(input.map((l) => l.id)).toEqual([2, 1]);
  });
});

describe("firstLedgerId", () => {
  it("is the earliest ledger by date then id", () => {
    expect(firstLedgerId([ledger(5, "2026-11-01", 0, 0), ledger(2, "2026-11-01", 0, 0), ledger(1, "2026-12-01", 0, 0)])).toBe(2);
  });

  it("is null without ledgers", () => {
    expect(firstLedgerId([])).toBeNull();
  });
});

describe("wouldBeFirst", () => {
  const others = [
    { id: 1, date: "2026-10-10" },
    { id: 2, date: "2026-11-01" },
  ];

  it("is true for the first ledger ever", () => {
    expect(wouldBeFirst([], { id: null, date: "2026-11-07" })).toBe(true);
  });

  it("is true for a new ledger dated before every existing one", () => {
    expect(wouldBeFirst(others, { id: null, date: "2026-10-09" })).toBe(true);
  });

  it("is false for a new ledger on the same date as the earliest (it is created later)", () => {
    expect(wouldBeFirst(others, { id: null, date: "2026-10-10" })).toBe(false);
  });

  it("is false for a new ledger dated after the earliest", () => {
    expect(wouldBeFirst(others, { id: null, date: "2026-12-01" })).toBe(false);
  });

  it("works for an existing ledger moved to another date", () => {
    expect(wouldBeFirst([{ id: 2, date: "2026-11-01" }], { id: 1, date: "2026-10-31" })).toBe(true);
    expect(wouldBeFirst([{ id: 2, date: "2026-11-01" }], { id: 1, date: "2026-11-01" })).toBe(true);
    expect(wouldBeFirst([{ id: 2, date: "2026-11-01" }], { id: 3, date: "2026-11-01" })).toBe(false);
  });
});
