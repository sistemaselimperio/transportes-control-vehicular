import { describe, expect, it } from "vitest";
import { currentLocalInput, formatTripDateTime, parseLocalInput, toLocalInput } from "./trip-datetime";

describe("parseLocalInput", () => {
  it("reads a datetime-local value as Colombia time (UTC-5)", () => {
    expect(parseLocalInput("2026-03-10T08:30")?.toISOString()).toBe("2026-03-10T13:30:00.000Z");
  });

  it("accepts seconds", () => {
    expect(parseLocalInput("2026-03-10T08:30:15")?.toISOString()).toBe("2026-03-10T13:30:15.000Z");
  });

  it("rejects blanks and malformed or impossible values", () => {
    expect(parseLocalInput("")).toBeNull();
    expect(parseLocalInput("10/03/2026 08:30")).toBeNull();
    expect(parseLocalInput("2026-03-10")).toBeNull();
    expect(parseLocalInput("2026-13-10T08:30")).toBeNull();
    expect(parseLocalInput("2026-02-30T08:30")).toBeNull();
    expect(parseLocalInput("2026-03-10T25:00")).toBeNull();
  });
});

describe("toLocalInput", () => {
  it("renders an instant as Colombia local time for a datetime-local input", () => {
    expect(toLocalInput(new Date("2026-03-10T13:30:00.000Z"))).toBe("2026-03-10T08:30");
    expect(toLocalInput(new Date("2026-03-11T03:05:00.000Z"))).toBe("2026-03-10T22:05");
  });

  it("round-trips with parseLocalInput", () => {
    const value = "2026-07-01T00:00";
    expect(toLocalInput(parseLocalInput(value)!)).toBe(value);
  });
});

describe("currentLocalInput", () => {
  it("is now in Colombia time", () => {
    expect(currentLocalInput(new Date("2026-03-10T13:30:45.000Z"))).toBe("2026-03-10T08:30");
  });
});

describe("formatTripDateTime", () => {
  it("shows dd/mm/yyyy and a 24h time", () => {
    expect(formatTripDateTime("2026-03-10T13:30:00.000Z")).toBe("10/03/2026 08:30");
  });
});
