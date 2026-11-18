import { describe, expect, it } from "vitest";
import {
  escapeLikePattern,
  exitFilterParam,
  INSPECTIONS_PAGE_SIZE,
  inspectionsHref,
  parseInspectionFilters,
  STATE_FILTER_OPTIONS,
  stateFilterParam,
} from "./inspection-filters";

describe("parseInspectionFilters", () => {
  it("defaults to no filters on the first page", () => {
    expect(parseInspectionFilters({})).toEqual({
      plate: "",
      from: null,
      to: null,
      driverId: null,
      vehicleId: null,
      exit: "ALL",
      state: "ALL",
      page: 1,
    });
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

describe("parseInspectionFilters checklist state", () => {
  it("maps the estado parameter to a state filter", () => {
    expect(parseInspectionFilters({ estado: "ok" }).state).toBe("OK");
    expect(parseInspectionFilters({ estado: "critico" }).state).toBe("CRITICAL");
    expect(parseInspectionFilters({ estado: "prioridad-alta" }).state).toBe("HIGH_PRIORITY");
  });

  it("offers the high priority option", () => {
    expect(STATE_FILTER_OPTIONS).toContainEqual({ value: "HIGH_PRIORITY", label: "Prioridad alta" });
  });

  it("falls back to all for anything else", () => {
    for (const bad of ["", "todos", "OK", "crítico", "x"]) expect(parseInspectionFilters({ estado: bad }).state).toBe("ALL");
    expect(parseInspectionFilters({}).state).toBe("ALL");
  });

  it("round-trips through stateFilterParam", () => {
    expect(stateFilterParam("ALL")).toBeNull();
    for (const state of ["OK", "CRITICAL", "HIGH_PRIORITY"] as const) {
      expect(parseInspectionFilters({ estado: stateFilterParam(state)! }).state).toBe(state);
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

describe("inspectionsHref", () => {
  const none = parseInspectionFilters({});

  it("is the bare path without filters", () => {
    expect(inspectionsHref(none)).toBe("/preoperacionales");
  });

  it("carries only the filters that have a value", () => {
    expect(inspectionsHref({ ...none, plate: "SWA" })).toBe("/preoperacionales?placa=SWA");
    expect(inspectionsHref({ ...none, from: "2026-03-01", exit: "NO_APTO" })).toBe(
      "/preoperacionales?desde=2026-03-01&salida=no-apto",
    );
    expect(inspectionsHref({ ...none, state: "CRITICAL" })).toBe("/preoperacionales?estado=critico");
    expect(inspectionsHref({ ...none, state: "HIGH_PRIORITY" })).toBe("/preoperacionales?estado=prioridad-alta");
  });

  it("keeps the driver and vehicle links and adds the page after the first", () => {
    expect(inspectionsHref({ ...none, driverId: 4, vehicleId: 9 }, 2)).toBe(
      "/preoperacionales?conductor=4&vehiculo=9&pagina=2",
    );
  });

  it("round-trips through parseInspectionFilters", () => {
    const filters = { ...none, plate: "SWA123", from: "2026-01-01", to: "2026-02-01", exit: "PENDING" as const, state: "OK" as const };
    const params = Object.fromEntries(new URL(inspectionsHref(filters), "http://x").searchParams);
    expect(parseInspectionFilters(params)).toEqual(filters);
  });
});
