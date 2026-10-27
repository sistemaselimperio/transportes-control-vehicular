import { describe, expect, it } from "vitest";
import { filterDriversByCompany, searchDrivers, sortDriverRows, type DriverRow } from "./driver-row";

const row = (over: Partial<DriverRow>): DriverRow => ({
  id: 1,
  name: "A",
  nationalId: null,
  phone: null,
  company: null,
  status: "ACTIVE",
  plates: [],
  ...over,
});

describe("filterDriversByCompany", () => {
  const rows = [
    row({ id: 1, company: "IMPERIO" }),
    row({ id: 2, company: "PAEZ" }),
    row({ id: 3, company: null }),
  ];

  it("keeps every driver when no group is selected", () => {
    expect(filterDriversByCompany(rows, null).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("keeps only drivers of the selected company", () => {
    expect(filterDriversByCompany(rows, "PAEZ").map((r) => r.id)).toEqual([2]);
  });
});

describe("sortDriverRows", () => {
  it("orders by name ignoring accents and case", () => {
    const rows = [row({ id: 1, name: "Ñ" }), row({ id: 2, name: "muñoz" }), row({ id: 3, name: "ÁLVAREZ" })];
    expect(sortDriverRows(rows).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});

describe("searchDrivers", () => {
  const rows = [
    row({ id: 1, name: "Jaime Castañeda", nationalId: "79123456", phone: "3142661585", plates: ["JSL-978"] }),
    row({ id: 2, name: "Ángel Pinilla", phone: "3209611503", plates: ["EQP-711"] }),
  ];
  const ids = (q: string) => searchDrivers(rows, q).map((r) => r.id);

  it("returns every row for an empty or blank query", () => {
    expect(ids("")).toEqual([1, 2]);
    expect(ids("   ")).toEqual([1, 2]);
  });

  it("matches the name ignoring case and accents", () => {
    expect(ids("castaneda")).toEqual([1]);
    expect(ids("ANGEL")).toEqual([2]);
  });

  it("matches the national id, the phone and the plates", () => {
    expect(ids("7912")).toEqual([1]);
    expect(ids("320961")).toEqual([2]);
    expect(ids("eqp711")).toEqual([2]);
    expect(ids("jsl-978")).toEqual([1]);
  });

  it("requires every word to match", () => {
    expect(ids("jaime 978")).toEqual([1]);
    expect(ids("jaime eqp")).toEqual([]);
  });
});
