import { describe, expect, it } from "vitest";
import { assertModelYear, EMPTY_TECHNICAL_DATA, technicalGroups, technicalProgress, technicalRows } from "./technical-data";
import { RuleError } from "./vehicle-rules";

describe("assertModelYear", () => {
  it("accepts null and years from 1950 up to next year", () => {
    expect(() => assertModelYear(null, "2026-10-17")).not.toThrow();
    expect(() => assertModelYear(1950, "2026-10-17")).not.toThrow();
    expect(() => assertModelYear(2027, "2026-10-17")).not.toThrow();
  });

  it("rejects years out of range", () => {
    expect(() => assertModelYear(1949, "2026-10-17")).toThrow(RuleError);
    expect(() => assertModelYear(2028, "2026-10-17")).toThrow(/modelo/i);
  });
});

describe("technicalRows", () => {
  it("shows a dash for empty values", () => {
    expect(technicalRows(EMPTY_TECHNICAL_DATA).every((r) => r.value === "—")).toBe(true);
  });

  it("formats dates, numbers and units", () => {
    const rows = technicalRows({
      ...EMPTY_TECHNICAL_DATA,
      registrationDate: "2020-09-28",
      modelYear: 2021,
      engineDisplacement: 14900,
      grossWeightKg: 52000,
      color: "BLANCO",
    });
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel["Fecha de matrícula"]).toBe("28/09/2020");
    expect(byLabel["Modelo"]).toBe("2021");
    expect(byLabel["Cilindraje"]).toBe("14.900 cc");
    expect(byLabel["Peso bruto vehicular"]).toBe("52.000 kg");
    expect(byLabel["Color"]).toBe("BLANCO");
  });

  it("does not show the fuel type", () => {
    const rows = technicalRows({ ...EMPTY_TECHNICAL_DATA, fuelType: "Diésel" });
    expect(rows.some((r) => r.label.includes("ombustible") || r.value.includes("Diésel"))).toBe(false);
  });
});

describe("technicalGroups", () => {
  it("splits the rows into identification and characteristics, each row once", () => {
    const groups = technicalGroups(EMPTY_TECHNICAL_DATA);
    expect(groups.map((g) => g.title)).toEqual(["Identificación", "Características"]);
    expect(groups[0].rows.map((r) => r.label)).toEqual([
      "Fecha de matrícula",
      "Número de motor",
      "Número de chasis",
      "Número de serie",
    ]);
    const labels = groups.flatMap((g) => g.rows.map((r) => r.label));
    expect([...labels].sort()).toEqual(technicalRows(EMPTY_TECHNICAL_DATA).map((r) => r.label).sort());
  });

  it("reports how many fields are on record", () => {
    const groups = technicalGroups({ ...EMPTY_TECHNICAL_DATA, modelYear: 2021, color: "BLANCO" });
    expect(groups.reduce((n, g) => n + g.known, 0)).toBe(2);
  });
});

describe("technicalProgress", () => {
  const full = {
    registrationDate: "2020-01-15",
    modelYear: 2020,
    engineNumber: "E1",
    chassisNumber: "C1",
    serialNumber: "S1",
    bodyType: "Furgón",
    fuelType: "Diésel",
    capacity: "34 t",
    engineDisplacement: 12000,
    grossWeightKg: 34000,
    color: "BLANCO",
  } as const;

  it("is missing when nothing is on record", () => {
    expect(technicalProgress(EMPTY_TECHNICAL_DATA)).toEqual({ known: 0, total: 10, state: "missing" });
  });

  it("is partial when some fields are on record", () => {
    expect(technicalProgress({ ...EMPTY_TECHNICAL_DATA, modelYear: 2021, color: "BLANCO" })).toEqual({
      known: 2,
      total: 10,
      state: "partial",
    });
  });

  it("is complete when every shown field is on record, whatever the fuel type", () => {
    expect(technicalProgress({ ...full, fuelType: null }).state).toBe("complete");
  });

  it("counts the same fields the vehicle file shows", () => {
    const data = { ...EMPTY_TECHNICAL_DATA, chassisNumber: "C1", capacity: "34 t" };
    expect(technicalProgress(data).known).toBe(technicalGroups(data).reduce((n, g) => n + g.known, 0));
  });
});
