import { describe, expect, it } from "vitest";
import { escapeLikePattern, exitFilterParam, INSPECTIONS_PAGE_SIZE, parseInspectionFilters } from "./inspection-filters";

describe("parseInspectionFilters", () => {
  it("defaults to no filters on the first page", () => {
    expect(parseInspectionFilters({})).toEqual({ plate: "", from: null, to: null, driverId: null, vehicleId: null, exit: "ALL", page: 1 });
  });

  it("normalizes the plate like the form does", () => {
    expect(parseInspectionFilters({ placa: " abc 12 " }).plate).toBe("ABC12");
  });

  it("drops the hyphen so 'ABC-123' and 'ABC123' find the same inspections", () => {
    expect(parseInspectionFilters({ placa: "abc-123" }).plate).toBe("ABC123");
  });

  it("keeps valid dates and drops invalid ones", () => {
    const filters = parseInspectionFilters({ desde: "2026-03-01", hasta: "not-a-date" });
    expect(filters.from).toBe("2026-03-01");
    expect(filters.to).toBeNull();
    expect(parseInspectionFilters({ desde: "2026-02-31" }).from).toBeNull();
  });

  it("swaps a reversed range", () => {
    const filters = parseInspectionFilters({ desde: "2026-03-10", hasta: "2026-03-01" });
    expect(filters.from).toBe("2026-03-01");
    expect(filters.to).toBe("2026-03-10");
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseInspectionFilters({ placa: ["abc", "xyz"] }).plate).toBe("ABC");
  });

  it("accepts only a positive whole page number", () => {
    expect(parseInspectionFilters({ pagina: "3" }).page).toBe(3);
    for (const bad of ["0", "-2", "1.5", "abc", "", "99999999999"]) {
      expect(parseInspectionFilters({ pagina: bad }).page).toBe(1);
    }
  });
});

describe("parseInspectionFilters driver and vehicle", () => {
  it("accepts only positive whole ids", () => {
    expect(parseInspectionFilters({ conductor: "12" }).driverId).toBe(12);
    expect(parseInspectionFilters({ vehiculo: "7" }).vehicleId).toBe(7);
    for (const bad of ["0", "-2", "1.5", "abc", "", "99999999999"]) {
      expect(parseInspectionFilters({ conductor: bad }).driverId).toBeNull();
      expect(parseInspectionFilters({ vehiculo: bad }).vehicleId).toBeNull();
    }
  });
});

describe("parseInspectionFilters exit status", () => {
  it("maps the salida parameter to a status filter", () => {
    expect(parseInspectionFilters({ salida: "pendientes" }).exit).toBe("PENDING");
    expect(parseInspectionFilters({ salida: "apto" }).exit).toBe("APTO");
    expect(parseInspectionFilters({ salida: "no-apto" }).exit).toBe("NO_APTO");
  });

  it("falls back to all for anything else", () => {
    for (const bad of ["", "todas", "APTO!", "x"]) expect(parseInspectionFilters({ salida: bad }).exit).toBe("ALL");
    expect(parseInspectionFilters({}).exit).toBe("ALL");
  });

  it("round-trips through exitFilterParam", () => {
    expect(exitFilterParam("ALL")).toBeNull();
    for (const exit of ["PENDING", "APTO", "NO_APTO"] as const) {
      expect(parseInspectionFilters({ salida: exitFilterParam(exit)! }).exit).toBe(exit);
    }
  });
});

describe("escapeLikePattern", () => {
  it("escapes the LIKE wildcards so the plate is matched literally", () => {
    expect(escapeLikePattern("A%B_C\\")).toBe("A\\%B\\_C\\\\");
  });
});

describe("INSPECTIONS_PAGE_SIZE", () => {
  it("is a sensible page size", () => {
    expect(INSPECTIONS_PAGE_SIZE).toBeGreaterThan(0);
    expect(INSPECTIONS_PAGE_SIZE).toBeLessThanOrEqual(100);
  });
});
