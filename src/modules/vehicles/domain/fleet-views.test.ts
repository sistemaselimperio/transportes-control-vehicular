import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterVehicleRows, type FilterableRow } from "./vehicle-filters";
import {
  FLEET_VIEWS,
  countByView,
  filtersForView,
  parseViewParam,
  viewFromFilters,
} from "./fleet-views";

function row(p: Partial<FilterableRow> & { plate: string }): FilterableRow {
  return {
    className: "Camión",
    ownerName: "X",
    ownerGroup: "IMPERIO",
    driverName: null,
    vehicleStatus: "ACTIVE",
    overall: "ok",
    ...p,
  };
}

const rows = [
  row({ plate: "A1", vehicleStatus: "ACTIVE", overall: "ok" }),
  row({ plate: "A2", vehicleStatus: "ACTIVE", overall: "expired" }),
  row({ plate: "A3", vehicleStatus: "ACTIVE", overall: "warning", ownerGroup: "PAEZ" }),
  row({ plate: "W1", vehicleStatus: "IN_WORKSHOP", overall: "warning" }),
  row({ plate: "I1", vehicleStatus: "IDLE", overall: "ok" }),
  row({ plate: "S1", vehicleStatus: "SOLD", overall: "inactive" }),
];

describe("parseViewParam", () => {
  it("accepts known views and defaults to todos", () => {
    expect(parseViewParam("activos")).toBe("activos");
    expect(parseViewParam("taller")).toBe("taller");
    expect(parseViewParam(["quietas", "x"])).toBe("quietas");
    expect(parseViewParam("nope")).toBe("todos");
    expect(parseViewParam(undefined)).toBe("todos");
  });

  it("lists every view exactly once, the default first", () => {
    const keys = FLEET_VIEWS.map((v) => v.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["todos", "activos", "alertas", "taller", "quietas", "vendidos"]);
  });
});

describe("filtersForView", () => {
  it("maps every view onto the existing status / alert filters", () => {
    expect(filtersForView("activos")).toMatchObject({ status: "ACTIVE", onlyAlerts: false });
    expect(filtersForView("alertas")).toMatchObject({ status: "NOT_SOLD", onlyAlerts: true });
    expect(filtersForView("taller")).toMatchObject({ status: "IN_WORKSHOP", onlyAlerts: false });
    expect(filtersForView("quietas")).toMatchObject({ status: "IDLE", onlyAlerts: false });
    expect(filtersForView("vendidos")).toMatchObject({ status: "SOLD", onlyAlerts: false });
    expect(filtersForView("todos")).toMatchObject({ status: "ALL", onlyAlerts: false });
  });

  it("leaves the other filters at their defaults", () => {
    const f = filtersForView("alertas");
    expect(f.search).toBe(DEFAULT_FILTERS.search);
    expect(f.group).toBe(DEFAULT_FILTERS.group);
  });
});

describe("viewFromFilters", () => {
  it("round-trips every view", () => {
    for (const { key } of FLEET_VIEWS) {
      expect(viewFromFilters(filtersForView(key))).toBe(key);
    }
  });

  it("returns null for combinations no tab represents", () => {
    expect(viewFromFilters({ ...DEFAULT_FILTERS })).toBeNull();
    expect(viewFromFilters({ ...DEFAULT_FILTERS, status: "ACTIVE", onlyAlerts: true })).toBeNull();
  });
});

describe("countByView", () => {
  it("counts each view with the same rules the table uses", () => {
    const counts = countByView(rows, "");
    expect(counts).toEqual({
      activos: 3,
      alertas: 3,
      taller: 1,
      quietas: 1,
      vendidos: 1,
      todos: 6,
    });
    for (const { key } of FLEET_VIEWS) {
      expect(counts[key]).toBe(filterVehicleRows(rows, filtersForView(key)).length);
    }
  });

  it("respects the owner group", () => {
    const counts = countByView(rows, "PAEZ");
    expect(counts.activos).toBe(1);
    expect(counts.alertas).toBe(1);
    expect(counts.todos).toBe(1);
  });
});
