import { describe, expect, it } from "vitest";
import {
  driverAtDate,
  monthBounds,
  normalizePlateQuery,
  parseLogbookQuery,
  parseTabParam,
  summarizeCost,
  summarizeFuel,
} from "./logbook";

describe("parseTabParam", () => {
  it("reads the known tabs", () => {
    expect(parseTabParam("aceite")).toBe("aceite");
    expect(parseTabParam("llantas")).toBe("llantas");
    expect(parseTabParam("combustible")).toBe("combustible");
  });

  it("falls back to servicios for anything else", () => {
    expect(parseTabParam(undefined)).toBe("servicios");
    expect(parseTabParam("nope")).toBe("servicios");
    expect(parseTabParam(["aceite", "llantas"])).toBe("aceite");
  });
});

describe("monthBounds", () => {
  it("covers the whole month", () => {
    expect(monthBounds("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("handles short and leap months", () => {
    expect(monthBounds("2026-02").to).toBe("2026-02-28");
    expect(monthBounds("2028-02").to).toBe("2028-02-29");
  });
});

describe("normalizePlateQuery", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normalizePlateQuery(" abc-12 ")).toBe("ABC12");
  });

  it("drops characters that are special in a LIKE pattern", () => {
    expect(normalizePlateQuery("%_")).toBe("");
  });
});

describe("parseLogbookQuery", () => {
  it("reads placa, desde, hasta and grupo from the search params", () => {
    expect(parseLogbookQuery({ placa: "abc-1", desde: "2026-05-01", hasta: "2026-05-31", grupo: "PAEZ" })).toEqual({
      plate: "ABC1",
      from: "2026-05-01",
      to: "2026-05-31",
      group: "PAEZ",
    });
  });

  it("defaults to no filters", () => {
    expect(parseLogbookQuery({})).toEqual({ plate: "", from: null, to: null, group: null });
  });

  it("ignores dates that are malformed or do not exist", () => {
    expect(parseLogbookQuery({ desde: "2026-5-1", hasta: "2026-02-30" })).toMatchObject({ from: null, to: null });
  });

  it("swaps an inverted range", () => {
    expect(parseLogbookQuery({ desde: "2026-08-10", hasta: "2026-07-15" })).toMatchObject({
      from: "2026-07-15",
      to: "2026-08-10",
    });
  });

  it("keeps an open-ended range", () => {
    expect(parseLogbookQuery({ desde: "2026-07-15" })).toMatchObject({ from: "2026-07-15", to: null });
  });
});

describe("driverAtDate", () => {
  const periods = [
    { id: 1, driverName: "Ana", fromDate: "2026-01-01", toDate: "2026-03-10" },
    { id: 2, driverName: "Beto", fromDate: "2026-03-10", toDate: null },
  ];

  it("returns the driver whose period covers the date", () => {
    expect(driverAtDate("2026-02-01", periods)).toBe("Ana");
    expect(driverAtDate("2026-06-01", periods)).toBe("Beto");
  });

  it("prefers the newer assignment on the hand-over day", () => {
    expect(driverAtDate("2026-03-10", periods)).toBe("Beto");
  });

  it("is null before any assignment", () => {
    expect(driverAtDate("2025-12-31", periods)).toBeNull();
    expect(driverAtDate("2026-01-01", [])).toBeNull();
  });
});

describe("summarizeCost", () => {
  it("adds the known prices and counts the rest", () => {
    expect(summarizeCost([{ price: 1000 }, { price: null }, { price: 2500 }])).toEqual({
      count: 3,
      total: 3500,
      withoutPrice: 1,
    });
  });
});

describe("summarizeFuel", () => {
  it("adds gallons and amounts without float noise", () => {
    expect(
      summarizeFuel([
        { gallons: 10.1, amount: 50000 },
        { gallons: 20.2, amount: 100000 },
      ]),
    ).toEqual({ count: 2, gallons: 30.3, amount: 150000 });
  });
});
