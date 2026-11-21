import { describe, expect, it } from "vitest";
import { loadIdSchema, loadSchema } from "./load-schemas";

const valid = {
  date: "2026-11-18",
  supplier: "Italcol",
  plate: "abc 123",
  tons: "32,5",
  cost: "$ 1.500.000",
  siesaNumber: " FV-100 ",
  orderNumber: " P-77 ",
  notes: "",
};

describe("loadSchema", () => {
  it("parses a valid form", () => {
    expect(loadSchema.parse(valid)).toEqual({
      date: "2026-11-18",
      supplier: "Italcol",
      plate: "ABC-123",
      tons: 32.5,
      cost: 1_500_000,
      siesaNumber: "FV-100",
      orderNumber: "P-77",
      notes: null,
      orderIds: [],
    });
  });

  it("requires a known supplier", () => {
    const r = loadSchema.safeParse({ ...valid, supplier: "Otro" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Elige el proveedor.");
  });

  it("requires the plate", () => {
    const r = loadSchema.safeParse({ ...valid, plate: "" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Elige la placa del vehículo.");
  });

  it("requires tons above zero", () => {
    for (const tons of ["", "0", "abc"]) {
      const r = loadSchema.safeParse({ ...valid, tons });
      expect(r.success).toBe(false);
      expect(!r.success && r.error.issues[0]?.message).toBe("Las toneladas deben ser un número mayor que cero.");
    }
  });

  it("accepts a zero cost but not a blank or negative one", () => {
    expect(loadSchema.parse({ ...valid, cost: "0" }).cost).toBe(0);
    const blank = loadSchema.safeParse({ ...valid, cost: "" });
    expect(!blank.success && blank.error.issues[0]?.message).toBe("Ingresa el costo en pesos.");
    expect(loadSchema.safeParse({ ...valid, cost: "-5" }).success).toBe(false);
    expect(loadSchema.safeParse({ ...valid, cost: "abc" }).success).toBe(false);
  });

  it("requires the SIESA and the order numbers", () => {
    const siesa = loadSchema.safeParse({ ...valid, siesaNumber: "  " });
    expect(!siesa.success && siesa.error.issues[0]?.message).toBe("Ingresa el número SIESA.");
    const order = loadSchema.safeParse({ ...valid, orderNumber: "" });
    expect(!order.success && order.error.issues[0]?.message).toBe("Ingresa el número de pedido.");
  });
});

describe("loadSchema orderIds", () => {
  it("parses the checked orders as unique positive ids", () => {
    expect(loadSchema.parse({ ...valid, orderIds: ["3", "5", "3"] }).orderIds).toEqual([3, 5]);
  });

  it("rejects an id that is not a positive integer", () => {
    for (const bad of ["x", "0", "-2", "1.5"]) {
      expect(loadSchema.safeParse({ ...valid, orderIds: [bad] }).success).toBe(false);
    }
  });
});

describe("loadIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(loadIdSchema.safeParse(2).success).toBe(true);
    expect(loadIdSchema.safeParse(0).success).toBe(false);
  });
});
