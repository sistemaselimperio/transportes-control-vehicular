import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  findMunicipality,
  isMunicipalityLabel,
  municipalityLabel,
} from "./municipalities";

describe("DEPARTMENTS", () => {
  it("holds the 33 DIVIPOLA departments with every municipality", () => {
    expect(DEPARTMENTS).toHaveLength(33);
    expect(DEPARTMENTS.reduce((n, d) => n + d.cities.length, 0)).toBe(1122);
  });
});

describe("municipalityLabel", () => {
  it("names the municipality with its department", () => {
    expect(municipalityLabel("15001")).toBe("TUNJA (BOYACÁ)");
  });

  it("does not repeat the department for Bogotá", () => {
    expect(municipalityLabel("11001")).toBe("BOGOTÁ, D.C.");
  });

  it("returns null for an unknown code", () => {
    expect(municipalityLabel("99999")).toBeNull();
  });
});

describe("findMunicipality", () => {
  it("resolves a stored label back to its department and code", () => {
    expect(findMunicipality("CAJICÁ (CUNDINAMARCA)")).toEqual({
      departmentCode: "25",
      code: "25126",
      label: "CAJICÁ (CUNDINAMARCA)",
    });
  });

  it("returns null for free text that is not in the catalog", () => {
    expect(findMunicipality("CAJICA-CUND")).toBeNull();
    expect(findMunicipality(null)).toBeNull();
  });
});

describe("isMunicipalityLabel", () => {
  it("accepts only catalog labels", () => {
    expect(isMunicipalityLabel("BOGOTÁ, D.C.")).toBe(true);
    expect(isMunicipalityLabel("Tunja")).toBe(false);
  });
});
