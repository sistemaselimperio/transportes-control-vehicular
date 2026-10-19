import { describe, expect, it } from "vitest";
import { filterDriversByCompany, sortDriverRows, type DriverRow } from "./driver-row";

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
