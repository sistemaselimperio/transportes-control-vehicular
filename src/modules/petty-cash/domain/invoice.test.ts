import { describe, expect, it } from "vitest";
import { isPossibleDuplicate, normalizeInvoiceNumber } from "./invoice";

describe("normalizeInvoiceNumber", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normalizeInvoiceNumber(" fe-0012 ")).toBe("FE0012");
    expect(normalizeInvoiceNumber("FE 0012.")).toBe("FE0012");
  });

  it("is empty for blank or missing numbers", () => {
    expect(normalizeInvoiceNumber(null)).toBe("");
    expect(normalizeInvoiceNumber("  - ")).toBe("");
  });
});

describe("isPossibleDuplicate", () => {
  it("flags the same invoice number of the same supplier", () => {
    expect(isPossibleDuplicate("900123", "FE-12", ["fe 12", "7"])).toBe(true);
  });

  it("does not flag a different invoice number", () => {
    expect(isPossibleDuplicate("900123", "FE-12", ["FE-13", null])).toBe(false);
  });

  it("never flags when the NIT or the invoice number is missing", () => {
    expect(isPossibleDuplicate(null, "FE-12", ["FE-12"])).toBe(false);
    expect(isPossibleDuplicate("", "FE-12", ["FE-12"])).toBe(false);
    expect(isPossibleDuplicate("900123", null, ["", null])).toBe(false);
    expect(isPossibleDuplicate("900123", "--", ["", "-"])).toBe(false);
  });
});
