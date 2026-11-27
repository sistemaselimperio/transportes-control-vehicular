import { describe, expect, it } from "vitest";
import { filterSettlements } from "./settlement-filter";
import type { SettlementRow } from "./settlement-rows";

const settlement = (over: Partial<SettlementRow>): SettlementRow => ({
  id: 1,
  number: 1,
  date: "2026-11-10",
  coteroKey: "doc:111111",
  coteroName: "José Pérez",
  coteroDocument: "111111",
  paymentMethod: null,
  paymentAccount: null,
  total: 100,
  status: "open",
  paidAt: null,
  hasProof: false,
  receiptCount: 1,
  ...over,
});

describe("filterSettlements", () => {
  const rows = [
    settlement({ id: 1, date: "2026-11-01" }),
    settlement({ id: 2, date: "2026-11-15", coteroKey: "name:maria", coteroName: "Maria", coteroDocument: null }),
  ];
  const none = { from: null, to: null, coteroKey: null, search: "" };

  it("keeps everything without filters", () => {
    expect(filterSettlements(rows, none)).toHaveLength(2);
  });

  it("filters by exact cotero and by inclusive date range", () => {
    expect(filterSettlements(rows, { ...none, coteroKey: "name:maria" }).map((s) => s.id)).toEqual([2]);
    expect(filterSettlements(rows, { ...none, from: "2026-11-02" }).map((s) => s.id)).toEqual([2]);
    expect(filterSettlements(rows, { ...none, to: "2026-11-01" }).map((s) => s.id)).toEqual([1]);
  });

  it("searches by name or cédula ignoring accents and case", () => {
    expect(filterSettlements(rows, { ...none, search: "jose" }).map((s) => s.id)).toEqual([1]);
    expect(filterSettlements(rows, { ...none, search: "1111" }).map((s) => s.id)).toEqual([1]);
  });
});
