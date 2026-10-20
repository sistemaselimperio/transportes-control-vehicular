import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  filterVehicleRows,
  ownerOptions,
  NO_OWNER,
  THIRD_PARTY_OWNER,
  parseFilterParams,
  titleCase,
  type FilterableRow,
} from "./vehicle-filters";

function r(p: Partial<FilterableRow> & { plate: string }): FilterableRow {
  return {
    className: "Camión",
    ownerName: "TRANSPORTES EL IMPERIO",
    ownerGroup: "IMPERIO",
    driverName: null,
    vehicleStatus: "ACTIVE",
    overall: "ok",
    ...p,
  };
}

const rows: FilterableRow[] = [
  r({ plate: "JVK-590", driverName: "HECTOR MONTAÑO", className: "Tractocamión" }),
  r({ plate: "XJA-347", overall: "expired", driverName: "JOSE GONZALEZ" }),
  r({ plate: "WOM-158", ownerGroup: "PAEZ", ownerName: "FABIÁN PÁEZ", overall: "warning" }),
  r({ plate: "S88490", ownerGroup: "THIRD_PARTY", ownerName: "BANCOLOMBIA", className: "Remolque" }),
  r({ plate: "R18936", ownerGroup: null, ownerName: null }),
  r({ plate: "PHU-161", vehicleStatus: "SOLD", overall: "inactive" }),
  r({ plate: "O35-ADL", vehicleStatus: "IDLE" }),
];

const plates = (list: FilterableRow[]) => list.map((x) => x.plate);

describe("filterVehicleRows", () => {
  it("hides sold vehicles by default", () => {
    expect(plates(filterVehicleRows(rows, DEFAULT_FILTERS))).not.toContain("PHU-161");
    expect(filterVehicleRows(rows, DEFAULT_FILTERS)).toHaveLength(6);
  });

  it("filters by status", () => {
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, status: "SOLD" }))).toEqual(["PHU-161"]);
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, status: "IDLE" }))).toEqual(["O35-ADL"]);
    expect(filterVehicleRows(rows, { ...DEFAULT_FILTERS, status: "ALL" })).toHaveLength(7);
  });

  it("filters by group, including vehicles without owner", () => {
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, group: "PAEZ" }))).toEqual(["WOM-158"]);
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, group: "THIRD_PARTY" }))).toEqual(["S88490"]);
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, group: "NONE" }))).toEqual(["R18936"]);
  });

  it("filters by owner and class", () => {
    expect(
      plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, owner: "BANCOLOMBIA" })),
    ).toEqual(["S88490"]);
    expect(
      plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, className: "Tractocamión" })),
    ).toEqual(["JVK-590"]);
  });

  it("groups every third-party owner under one owner option", () => {
    expect(
      plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, owner: THIRD_PARTY_OWNER })),
    ).toEqual(["S88490"]);
  });

  it("finds vehicles without owner through the owner filter", () => {
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, owner: NO_OWNER }))).toEqual(["R18936"]);
  });

  it("shows only vehicles with alerts when asked", () => {
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, onlyAlerts: true }))).toEqual([
      "XJA-347",
      "WOM-158",
    ]);
  });

  it("searches plate (ignoring hyphen and case) and driver", () => {
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, search: "jvk590" }))).toEqual(["JVK-590"]);
    expect(plates(filterVehicleRows(rows, { ...DEFAULT_FILTERS, search: "montano" }))).toEqual(["JVK-590"]);
  });
});

describe("ownerOptions", () => {
  it("lists only the company's own owners, sorted and without repeats", () => {
    const rows = [
      { ownerName: "TRANSPORTES EL IMPERIO", ownerGroup: "IMPERIO" as const },
      { ownerName: "BANCOLOMBIA", ownerGroup: "THIRD_PARTY" as const },
      { ownerName: "FABIÁN PÁEZ", ownerGroup: "PAEZ" as const },
      { ownerName: "FABIÁN PÁEZ", ownerGroup: "PAEZ" as const },
      { ownerName: null, ownerGroup: null },
    ];
    expect(ownerOptions(rows).map((o) => o.value)).toEqual(["FABIÁN PÁEZ", "TRANSPORTES EL IMPERIO"]);
  });

  it("leaves Sandra Páez out of the options", () => {
    const rows = [
      { ownerName: "SANDRA MARCELA PÁEZ PORRAS", ownerGroup: "PAEZ" as const },
      { ownerName: "FABIÁN PÁEZ", ownerGroup: "PAEZ" as const },
    ];
    expect(ownerOptions(rows).map((o) => o.value)).toEqual(["FABIÁN PÁEZ"]);
  });

  it("labels each owner in title case and keeps the stored name as the value", () => {
    const rows = [{ ownerName: "TRANSPORTES EL IMPERIO", ownerGroup: "IMPERIO" as const }];
    expect(ownerOptions(rows)).toEqual([{ value: "TRANSPORTES EL IMPERIO", label: "Transportes El Imperio" }]);
  });
});

describe("titleCase", () => {
  it("capitalizes the first letter of each word and lowers the rest", () => {
    expect(titleCase("FABIÁN PÁEZ")).toBe("Fabián Páez");
    expect(titleCase("sin  propietario")).toBe("Sin  Propietario");
  });
});

describe("parseFilterParams", () => {
  it("returns the defaults without params", () => {
    expect(parseFilterParams({})).toEqual(DEFAULT_FILTERS);
  });

  it("reads group, status and alerts", () => {
    expect(parseFilterParams({ grupo: "PAEZ", estado: "IN_WORKSHOP", alertas: "1" })).toEqual({
      ...DEFAULT_FILTERS,
      group: "PAEZ",
      status: "IN_WORKSHOP",
      onlyAlerts: true,
    });
  });

  it("ignores unknown values and takes the first of repeated params", () => {
    expect(parseFilterParams({ grupo: "x", estado: "y", alertas: "0" })).toEqual(DEFAULT_FILTERS);
    expect(parseFilterParams({ grupo: ["NONE", "PAEZ"] }).group).toBe("NONE");
  });
});
