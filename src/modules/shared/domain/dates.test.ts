import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, formatDisplayDate } from "./dates";

describe("daysBetween", () => {
  it("returns positive days when target is after origin", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });
  it("returns negative days when target is before origin", () => {
    expect(daysBetween("2026-01-10", "2026-01-05")).toBe(-5);
  });
  it("is not affected by leap years", () => {
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });
});

describe("addMonths", () => {
  it("adds months within the same year", () => {
    expect(addMonths("2026-01-15", 2)).toBe("2026-03-15");
  });
  it("rolls over the year", () => {
    expect(addMonths("2026-11-10", 3)).toBe("2027-02-10");
  });
  it("clamps to the last day of shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });
});

describe("formatDisplayDate", () => {
  it("formats ISO days as dd/mm/yyyy", () => {
    expect(formatDisplayDate("2026-09-04")).toBe("04/09/2026");
  });
  it("returns an empty string for null", () => {
    expect(formatDisplayDate(null)).toBe("");
  });
});
