import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  findMunicipality,
  isMunicipalityLabel,
  municipalityLabel,
} from "./municipalities";

describe("DEPARTMENTS", () => {
  it("names departments with the first letter of each word in uppercase", () => {
    expect(DEPARTMENTS.find((d) => d.code === "15")?.name).toBe("Boyacá");
    expect(DEPARTMENTS.find((d) => d.code === "54")?.name).toBe("Norte de Santander");
  });

  it("holds the 33 DIVIPOLA departments with every municipality", () => {
    expect(DEPARTMENTS).toHaveLength(33);
    expect(DEPARTMENTS.reduce((n, d) => n + d.cities.length, 0)).toBe(1122);
  });
});

describe("municipalityLabel", () => {
  it("names the municipality with its department", () => {
    expect(municipalityLabel("15001")).toBe("Tunja (Boyacá)");
  });

  it("capitalizes each word but keeps connectors in lowercase", () => {
    expect(municipalityLabel("05697")).toBe("El Santuario (Antioquia)");
    expect(municipalityLabel("05664")).toBe("San Pedro de los Milagros (Antioquia)");
    expect(municipalityLabel("88001")).toBe("San Andrés (Archipiélago de San Andrés, Providencia y Santa Catalina)");
  });

  it("does not repeat the department for Bogotá", () => {
    expect(municipalityLabel("11001")).toBe("Bogotá, D.C.");
  });

  it("returns null for an unknown code", () => {
    expect(municipalityLabel("99999")).toBeNull();
  });
});

describe("findMunicipality", () => {
  it("resolves a stored label back to its department and code", () => {
    expect(findMunicipality("Cajicá (Cundinamarca)")).toEqual({
      departmentCode: "25",
      code: "25126",
      label: "Cajicá (Cundinamarca)",
    });
  });

  it("returns null for free text that is not in the catalog", () => {
    expect(findMunicipality("CAJICA-CUND")).toBeNull();
    expect(findMunicipality(null)).toBeNull();
  });
});

describe("isMunicipalityLabel", () => {
  it("accepts only catalog labels", () => {
    expect(isMunicipalityLabel("Bogotá, D.C.")).toBe(true);
    expect(isMunicipalityLabel("BOGOTÁ, D.C.")).toBe(false);
    expect(isMunicipalityLabel("Tunja")).toBe(false);
  });
});
