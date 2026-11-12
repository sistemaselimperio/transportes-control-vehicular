import { describe, expect, it } from "vitest";
import { formatLedgerTitle, formatSheetDate } from "./ledger-date";

describe("formatSheetDate", () => {
  it("writes the month name in capitals, then the day without padding and the year", () => {
    expect(formatSheetDate("2026-11-07")).toBe("NOVIEMBRE 7 2026");
    expect(formatSheetDate("2026-01-31")).toBe("ENERO 31 2026");
    expect(formatSheetDate("2025-12-15")).toBe("DICIEMBRE 15 2025");
  });

  it("covers all twelve months", () => {
    const names = Array.from({ length: 12 }, (_, i) => formatSheetDate(`2026-${String(i + 1).padStart(2, "0")}-01`).split(" ")[0]);
    expect(names).toEqual([
      "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
    ]);
  });
});

describe("formatLedgerTitle", () => {
  it("writes the month capitalized, the day without padding, a comma and the year", () => {
    expect(formatLedgerTitle("2026-11-07")).toBe("Noviembre 7, 2026");
    expect(formatLedgerTitle("2026-01-31")).toBe("Enero 31, 2026");
  });
});
