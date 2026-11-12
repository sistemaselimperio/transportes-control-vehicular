import { describe, expect, it } from "vitest";
import { ledgerSlug, parseLedgerParam } from "./ledger-slug";

describe("ledgerSlug", () => {
  it("names the ledger by its own consecutive number", () => {
    expect(ledgerSlug(12)).toBe("planilla-12");
    expect(ledgerSlug(1)).toBe("planilla-1");
  });
});

describe("parseLedgerParam", () => {
  it("reads a planilla slug as a ledger number", () => {
    expect(parseLedgerParam("planilla-12")).toEqual({ kind: "number", number: 12 });
  });

  it("is case-insensitive", () => {
    expect(parseLedgerParam("Planilla-3")).toEqual({ kind: "number", number: 3 });
  });

  it("reads plain digits as a legacy database id", () => {
    expect(parseLedgerParam("7")).toEqual({ kind: "legacyId", id: 7 });
  });

  it("rejects zero, negatives and leading zeros", () => {
    for (const p of ["0", "planilla-0", "-3", "planilla--3", "007", "planilla-012"]) {
      expect(parseLedgerParam(p), p).toBeNull();
    }
  });

  it("rejects junk and numbers too large for the database", () => {
    for (const p of ["", "planilla", "planilla-", "planilla-1a", "abc", "1.5", "planilla-1-2", " planilla-1", "1234567890", "planilla-1234567890"]) {
      expect(parseLedgerParam(p), p).toBeNull();
    }
  });
});
