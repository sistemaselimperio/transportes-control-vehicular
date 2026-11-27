import { describe, expect, it } from "vitest";
import { bogotaInstant, formatBogotaTime, isTimeOfDay } from "./turn-window";

describe("bogotaInstant", () => {
  it("reads a Bogotá wall-clock time (UTC-5) as an instant", () => {
    expect(bogotaInstant("2026-11-27", "07:30").toISOString()).toBe("2026-11-27T12:30:00.000Z");
  });
  it("rolls over midnight UTC", () => {
    expect(bogotaInstant("2026-11-27", "20:00").toISOString()).toBe("2026-11-28T01:00:00.000Z");
  });
});

describe("formatBogotaTime", () => {
  it("is the inverse of bogotaInstant", () => {
    expect(formatBogotaTime(bogotaInstant("2026-11-27", "06:05"))).toBe("06:05");
    expect(formatBogotaTime(new Date("2026-11-28T01:00:00Z"))).toBe("20:00");
  });
});

describe("isTimeOfDay", () => {
  it("accepts HH:mm", () => {
    expect(isTimeOfDay("00:00")).toBe(true);
    expect(isTimeOfDay("23:59")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const v of ["24:00", "7:30", "12:60", "", "12:30:00", "ab:cd"]) expect(isTimeOfDay(v)).toBe(false);
  });
});
