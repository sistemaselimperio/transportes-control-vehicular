import { describe, expect, it } from "vitest";
import { formatSheetDay, settlementSheetLines } from "./sheet-format";

describe("formatSheetDay", () => {
  it("writes the day and the month in capitals", () => {
    expect(formatSheetDay("2026-11-11")).toBe("11 DE NOVIEMBRE");
    expect(formatSheetDay("2026-03-01")).toBe("1 DE MARZO");
    expect(formatSheetDay("2026-09-30")).toBe("30 DE SEPTIEMBRE");
  });
});

describe("settlementSheetLines", () => {
  const receipts = [
    { date: "2026-11-11", tons: 33.213, tariffPerTon: 9800, amount: 325498 },
    { date: "2026-11-12", tons: 12.88, tariffPerTon: null, amount: 126224 },
  ];

  it("makes one line per receipt with the written amount as its total", () => {
    const lines = settlementSheetLines(receipts);
    expect(lines).toEqual([
      { day: "11 DE NOVIEMBRE", tons: 33.213, unitPrice: 9800, total: 325498 },
      { day: "12 DE NOVIEMBRE", tons: 12.88, unitPrice: 9800, total: 126224 },
    ]);
  });

  it("derives the unit price from the amount when no tariff was in force", () => {
    expect(settlementSheetLines([{ date: "2025-01-01", tons: 10, tariffPerTon: null, amount: 100000 }])[0].unitPrice).toBe(10000);
  });
});
