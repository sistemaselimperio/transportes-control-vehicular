import { describe, expect, it } from "vitest";
import {
  DAILY_REPORT_STARTS_AT,
  latestPerPlate,
  parseDailyReportDate,
  type DailyReportCandidate,
} from "./daily-report";

const row = (over: Partial<DailyReportCandidate> = {}): DailyReportCandidate => ({
  id: "a",
  createdAt: new Date("2026-03-14T12:00:00Z"),
  plate: "ABC-123",
  trailerPlate: null,
  driverName: "Juan",
  odometer: "100",
  restHours: "8 horas",
  route: "Bogotá",
  location: "Peaje",
  fuel: "Full",
  pendingMaintenance: "Ninguno",
  ...over,
});

describe("latestPerPlate", () => {
  it("keeps only the latest inspection of each plate", () => {
    const rows = [
      row({ id: "old", createdAt: new Date("2026-03-14T10:00:00Z") }),
      row({ id: "new", createdAt: new Date("2026-03-14T14:00:00Z") }),
      row({ id: "mid", createdAt: new Date("2026-03-14T12:00:00Z") }),
      row({ id: "other", plate: "XYZ-987" }),
    ];
    expect(latestPerPlate(rows).map((r) => r.id)).toEqual(["new", "other"]);
  });

  it("treats spellings of the same plate as one", () => {
    const rows = [
      row({ id: "a", plate: "abc 123", createdAt: new Date("2026-03-14T10:00:00Z") }),
      row({ id: "b", plate: "ABC-123", createdAt: new Date("2026-03-14T11:00:00Z") }),
    ];
    expect(latestPerPlate(rows).map((r) => r.id)).toEqual(["b"]);
  });

  it("sorts by plate and drops the createdAt helper", () => {
    const result = latestPerPlate([row({ id: "z", plate: "ZZZ-999" }), row({ id: "a", plate: "AAA-111" })]);
    expect(result.map((r) => r.plate)).toEqual(["AAA-111", "ZZZ-999"]);
    expect(result[0]).not.toHaveProperty("createdAt");
  });

  it("keeps null daily-report fields of older rows", () => {
    const [only] = latestPerPlate([row({ restHours: null, location: null, fuel: null, pendingMaintenance: null })]);
    expect(only.restHours).toBeNull();
    expect(only.location).toBeNull();
  });

  it("returns an empty list for no rows", () => {
    expect(latestPerPlate([])).toEqual([]);
  });
});

describe("DAILY_REPORT_STARTS_AT", () => {
  it("is 18 Nov 2026 at 3 p.m. in Bogotá (UTC-5)", () => {
    expect(DAILY_REPORT_STARTS_AT.toISOString()).toBe("2026-11-18T20:00:00.000Z");
  });
});

describe("parseDailyReportDate", () => {
  it("accepts a real ISO date", () => {
    expect(parseDailyReportDate("2026-03-14", "2026-05-01")).toBe("2026-03-14");
  });

  it("falls back to today for missing or invalid values", () => {
    expect(parseDailyReportDate(undefined, "2026-05-01")).toBe("2026-05-01");
    expect(parseDailyReportDate("2026-02-30", "2026-05-01")).toBe("2026-05-01");
    expect(parseDailyReportDate(["2026-03-14", "x"], "2026-05-01")).toBe("2026-03-14");
    expect(parseDailyReportDate("hoy", "2026-05-01")).toBe("2026-05-01");
  });
});
