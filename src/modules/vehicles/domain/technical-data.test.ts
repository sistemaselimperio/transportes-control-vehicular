import { describe, expect, it } from "vitest";
import { assertModelYear, EMPTY_TECHNICAL_DATA, technicalRows } from "./technical-data";
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
});
