import { describe, expect, it } from "vitest";
import { taxStatus } from "./tax-status";

describe("taxStatus", () => {
  it("is expired when the paid year is before the current year", () => {
    expect(taxStatus({ kind: "PAID_YEAR", year: 2025, currentYear: 2026 })).toBe(
      "expired",
    );
  });
  it("is ok when the paid year is the current year", () => {
    expect(taxStatus({ kind: "PAID_YEAR", year: 2026, currentYear: 2026 })).toBe(
      "ok",
    );
  });
  it("is ok when paid ahead", () => {
    expect(taxStatus({ kind: "PAID_YEAR", year: 2027, currentYear: 2026 })).toBe(
      "ok",
    );
  });
  it("is warning when PAID_YEAR has no year", () => {
    expect(
      taxStatus({ kind: "PAID_YEAR", year: null, currentYear: 2026 }),
    ).toBe("warning");
  });
  it("is not_applicable for exemptions", () => {
    expect(taxStatus({ kind: "EXEMPT", currentYear: 2026 })).toBe(
      "not_applicable",
    );
    expect(
      taxStatus({ kind: "EXEMPT_LOW_DISPLACEMENT", currentYear: 2026 }),
    ).toBe("not_applicable");
  });
  it("is warning (no data) when unknown", () => {
    expect(taxStatus({ kind: "UNKNOWN", currentYear: 2026 })).toBe("warning");
  });
});
