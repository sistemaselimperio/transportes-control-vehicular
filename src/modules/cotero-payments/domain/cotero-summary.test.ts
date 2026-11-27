import { describe, expect, it } from "vitest";
import { summarizeCoteros } from "./cotero-summary";
import type { ReceiptRow } from "./receipt-rules";

const row = (over: Partial<ReceiptRow>): ReceiptRow => ({
  id: 1,
  receiptNumber: "T-1",
  date: "2026-11-01",
  destination: "",
  remissions: [],
  tons: 10,
  vehiclePlate: "ABC123",
  trailerPlate: null,
  coteroKey: "doc:111111",
  coteroName: "Juan Perez",
  coteroDocument: "111111",
  driverName: "Pedro",
  amount: 100,
  tariffPerTon: null,
  expectedAmount: null,
  amountMismatch: false,
  filePath: null,
  pageNumber: null,
  status: "pending",
  settlementId: null,
  settlementNumber: null,
  ...over,
});

describe("summarizeCoteros", () => {
  it("is empty without receipts", () => {
    expect(summarizeCoteros([])).toEqual([]);
  });

  it("makes one entry per cotero with count, pending count and pending amount", () => {
    const [juan] = summarizeCoteros([
      row({ id: 1, amount: 100, status: "pending" }),
      row({ id: 2, amount: 200, status: "settled" }),
      row({ id: 3, amount: 300, status: "pending" }),
      row({ id: 4, amount: 400, status: "paid" }),
    ]);
    expect(juan.count).toBe(4);
    expect(juan.pending).toEqual({ count: 2, tons: 20, amount: 400 });
    expect(juan.all).toEqual({ count: 4, tons: 40, amount: 1000 });
  });

  it("lists each cotero's receipts newest first and reports the last date", () => {
    const [juan] = summarizeCoteros([
      row({ id: 1, date: "2026-11-01" }),
      row({ id: 3, date: "2026-11-05" }),
      row({ id: 2, date: "2026-11-05" }),
    ]);
    expect(juan.receipts.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(juan.lastDate).toBe("2026-11-05");
  });

  it("sorts coteros by most recent receipt, then by name", () => {
    const maria = { coteroKey: "name:maria", coteroName: "Maria", coteroDocument: null };
    const ana = { coteroKey: "name:ana", coteroName: "Ana", coteroDocument: null };
    const summaries = summarizeCoteros([
      row({ id: 1, date: "2026-11-01" }),
      row({ id: 2, date: "2026-11-09", ...maria }),
      row({ id: 3, date: "2026-11-09", ...ana }),
    ]);
    expect(summaries.map((s) => s.name)).toEqual(["Ana", "Maria", "Juan Perez"]);
  });

  it("names the cotero after the latest receipt and keeps the cédula of any receipt", () => {
    const [cotero] = summarizeCoteros([
      row({ id: 1, date: "2026-11-01", coteroName: "Juan Perez" }),
      row({ id: 2, date: "2026-11-03", coteroName: "Jhon Peres" }),
    ]);
    expect(cotero.name).toBe("Jhon Peres");
    expect(cotero.document).toBe("111111");
  });

  it("rounds tons to three decimals", () => {
    const [cotero] = summarizeCoteros([row({ id: 1, tons: 0.1 }), row({ id: 2, tons: 0.2 })]);
    expect(cotero.all.tons).toBe(0.3);
  });
});
