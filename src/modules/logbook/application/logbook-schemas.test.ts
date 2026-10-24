import { describe, expect, it } from "vitest";
import {
  entryIdSchema,
  fuelEditSchema,
  fuelSchema,
  serviceEditSchema,
  serviceSchema,
  tireEditSchema,
  tireSchema,
} from "./logbook-schemas";

describe("serviceSchema", () => {
  it("normalizes the raw form values", () => {
    expect(
      serviceSchema.parse({
        plate: "abc-123",
        date: "2026-05-10",
        kind: "CORRECTIVE",
        description: "  Cambio de bomba ",
        provider: " Taller Pérez ",
        km: "120.500",
        price: "1.250.000",
        notes: " ",
      }),
    ).toEqual({
      plate: "abc-123",
      date: "2026-05-10",
      kind: "CORRECTIVE",
      description: "Cambio de bomba",
      provider: "Taller Pérez",
      km: 120500,
      price: 1_250_000,
      notes: null,
    });
  });

  it("allows an unknown provider, price, km and notes", () => {
    expect(
      serviceSchema.parse({ plate: "ABC-123", date: "2026-05-10", kind: "PREVENTIVE", description: "Revisión" }),
    ).toMatchObject({ provider: null, price: null, km: null, notes: null });
  });

  it("requires the description and the kind", () => {
    expect(() =>
      serviceSchema.parse({ plate: "ABC-123", date: "2026-05-10", kind: "CORRECTIVE", description: " " }),
    ).toThrow("Describe el mantenimiento");
    expect(() =>
      serviceSchema.parse({ plate: "ABC-123", date: "2026-05-10", kind: "OTHER", description: "x" }),
    ).toThrow("tipo de mantenimiento");
  });

  it("requires the vehicle and a valid date", () => {
    expect(() => serviceSchema.parse({ date: "2026-05-10", kind: "CORRECTIVE", description: "x" })).toThrow();
    expect(() =>
      serviceSchema.parse({ plate: "ABC-123", date: "2026-13-45", kind: "CORRECTIVE", description: "x" }),
    ).toThrow("fecha");
  });

  it("rejects a price that is not a whole number", () => {
    expect(() =>
      serviceSchema.parse({ plate: "ABC-123", date: "2026-05-10", kind: "CORRECTIVE", description: "x", price: "12a" }),
    ).toThrow("El precio");
  });

  it("the edit schema has no vehicle", () => {
    const parsed = serviceEditSchema.parse({ date: "2026-05-10", kind: "PREVENTIVE", description: "x" });
    expect(parsed).not.toHaveProperty("plate");
  });
});

describe("tireSchema", () => {
  it("normalizes the raw form values", () => {
    expect(
      tireSchema.parse({
        plate: "ABC-123",
        date: "2026-05-10",
        quantity: "6",
        reference: " 295/80R22.5 ",
        provider: "Llantas del Sur",
        price: "3.000.000",
        notes: "Traseras",
      }),
    ).toEqual({
      plate: "ABC-123",
      date: "2026-05-10",
      quantity: 6,
      reference: "295/80R22.5",
      provider: "Llantas del Sur",
      price: 3_000_000,
      notes: "Traseras",
    });
  });

  it("requires a positive quantity and a detail", () => {
    const base = { plate: "ABC-123", date: "2026-05-10", reference: "x" };
    expect(() => tireSchema.parse({ ...base, quantity: "0" })).toThrow("cantidad");
    expect(() => tireSchema.parse({ ...base, quantity: "" })).toThrow("cantidad");
    expect(() => tireSchema.parse({ ...base, quantity: "99" })).toThrow("cantidad");
    expect(() => tireSchema.parse({ plate: "ABC-123", date: "2026-05-10", quantity: "2", reference: " " })).toThrow(
      "detalle de la llanta",
    );
  });

  it("the edit schema has no vehicle", () => {
    const parsed = tireEditSchema.parse({ date: "2026-05-10", quantity: "2", reference: "x" });
    expect(parsed).not.toHaveProperty("plate");
  });
});

describe("fuelSchema", () => {
  it("reads gallons with a decimal comma or dot and the amount in pesos", () => {
    const base = { plate: "ABC-123", date: "2026-05-10", amount: "250.000", provider: "Terpel" };
    expect(fuelSchema.parse({ ...base, gallons: "45,5" })).toEqual({
      plate: "ABC-123",
      date: "2026-05-10",
      gallons: 45.5,
      amount: 250_000,
      provider: "Terpel",
    });
    expect(fuelSchema.parse({ ...base, gallons: "45.25" }).gallons).toBe(45.25);
    expect(fuelSchema.parse({ ...base, gallons: "45" }).gallons).toBe(45);
  });

  it("requires a quantity and amount greater than zero", () => {
    const base = { plate: "ABC-123", date: "2026-05-10" };
    expect(() => fuelSchema.parse({ ...base, gallons: "", amount: "1000" })).toThrow("la cantidad");
    expect(() => fuelSchema.parse({ ...base, gallons: "0", amount: "1000" })).toThrow("la cantidad");
    expect(() => fuelSchema.parse({ ...base, gallons: "12,345", amount: "1000" })).toThrow("la cantidad");
    expect(() => fuelSchema.parse({ ...base, gallons: "10", amount: "" })).toThrow("valor");
    expect(() => fuelSchema.parse({ ...base, gallons: "10", amount: "0" })).toThrow("valor");
  });

  it("the edit schema has no vehicle", () => {
    const parsed = fuelEditSchema.parse({ date: "2026-05-10", gallons: "10", amount: "1000" });
    expect(parsed).not.toHaveProperty("plate");
    expect(parsed.provider).toBeNull();
  });
});

describe("entryIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(entryIdSchema.parse(5)).toBe(5);
    expect(() => entryIdSchema.parse(0)).toThrow();
    expect(() => entryIdSchema.parse(1.5)).toThrow();
  });
});
