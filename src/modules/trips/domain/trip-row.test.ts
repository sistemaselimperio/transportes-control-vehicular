import { describe, expect, it } from "vitest";
import { filterTrips, parsePlateParam, sortTrips, suggestDestinations, type TripRow } from "./trip-row";

const row = (over: Partial<TripRow>): TripRow => ({
  id: 1,
  startAt: "2026-03-10T13:00:00.000Z",
  destination: "Bogotá",
  plate: "ABC-123",
  vehicleId: 1,
  area: "Cemento",
  status: "programado",
  ...over,
});

describe("sortTrips", () => {
  it("puts the newest start first and does not mutate", () => {
    const rows = [
      row({ id: 1, startAt: "2026-03-01T10:00:00.000Z" }),
      row({ id: 2, startAt: "2026-03-05T10:00:00.000Z" }),
      row({ id: 3, startAt: "2026-03-03T10:00:00.000Z" }),
    ];
    expect(sortTrips(rows).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("breaks ties with the newest id", () => {
    const rows = [row({ id: 1 }), row({ id: 2 })];
    expect(sortTrips(rows).map((r) => r.id)).toEqual([2, 1]);
  });
});

describe("filterTrips", () => {
  const rows = [
    row({ id: 1, destination: "Cúcuta", plate: "ABC-123", area: "Cemento", status: "programado" }),
    row({ id: 2, destination: "Medellín", plate: "XYZ-987", area: "Abono", status: "en_ruta" }),
    row({ id: 3, destination: "Cúcuta", plate: "DEF-456", area: "Abono", status: "entregado" }),
  ];

  it("keeps everything with no filter", () => {
    expect(filterTrips(rows, { status: "ALL", area: "ALL", query: "" })).toHaveLength(3);
  });

  it("filters by status", () => {
    expect(filterTrips(rows, { status: "en_ruta", area: "ALL", query: "" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by area", () => {
    expect(filterTrips(rows, { status: "ALL", area: "Abono", query: "" }).map((r) => r.id)).toEqual([2, 3]);
  });

  it("searches plate and destination ignoring case, accents and dashes", () => {
    expect(filterTrips(rows, { status: "ALL", area: "ALL", query: "cucuta" }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterTrips(rows, { status: "ALL", area: "ALL", query: "xyz987" }).map((r) => r.id)).toEqual([2]);
    expect(filterTrips(rows, { status: "ALL", area: "ALL", query: "xyz-987" }).map((r) => r.id)).toEqual([2]);
  });

  it("combines the filters", () => {
    expect(filterTrips(rows, { status: "entregado", area: "Abono", query: "cucuta" }).map((r) => r.id)).toEqual([3]);
  });
});

describe("suggestDestinations", () => {
  it("returns the distinct destinations, A to Z", () => {
    const rows = [row({ destination: "Medellín" }), row({ destination: "Cúcuta" }), row({ destination: "Medellín" })];
    expect(suggestDestinations(rows)).toEqual(["Cúcuta", "Medellín"]);
  });
});

describe("parsePlateParam", () => {
  it("canonicalizes a plate", () => {
    expect(parsePlateParam("abc123")).toBe("ABC-123");
    expect(parsePlateParam(" abc 12d ")).toBe("ABC-12D");
  });

  it("is empty when missing or blank", () => {
    expect(parsePlateParam(undefined)).toBe("");
    expect(parsePlateParam("   ")).toBe("");
  });

  it("reads the first value of a repeated param", () => {
    expect(parsePlateParam(["abc123", "xyz987"])).toBe("ABC-123");
  });
});
