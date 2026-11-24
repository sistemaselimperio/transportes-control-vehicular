import { describe, expect, it } from "vitest";
import { loadIdSchema, loadSchema } from "./load-schemas";

const line = { referenceId: 10, tons: "32,5", cost: "$ 1.500.000", siesaNumber: " FV-100 ", orderNumber: " P-77 " };

const valid = {
  date: "2026-11-18",
  supplier: "Italcol",
  plate: "abc 123",
  notes: "",
  lines: JSON.stringify([line]),
};

const withLines = (lines: unknown[]) => ({ ...valid, lines: JSON.stringify(lines) });
const firstIssue = (input: unknown) => {
  const r = loadSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("loadSchema", () => {
  it("parses a valid form", () => {
    expect(loadSchema.parse(valid)).toEqual({
      date: "2026-11-18",
      supplier: "Italcol",
      plate: "ABC-123",
      notes: null,
      orderIds: [],
      lines: [{ referenceId: 10, tons: 32.5, cost: 1_500_000, siesaNumber: "FV-100", orderNumber: "P-77" }],
    });
  });

  it("requires a known supplier", () => {
    expect(firstIssue({ ...valid, supplier: "Otro" })).toBe("Elige el proveedor.");
  });

  it("requires the plate", () => {
    expect(firstIssue({ ...valid, plate: "" })).toBe("Elige la placa del vehículo.");
  });

  it("requires at least one line", () => {
    expect(firstIssue({ ...valid, lines: "[]" })).toBe("Agrega al menos un producto al cargue.");
    expect(firstIssue({ ...valid, lines: "no json" })).toBe("Los productos del cargue no son válidos.");
  });

  it("requires a product on each line", () => {
    for (const referenceId of [null, undefined, 0, 1.5, "10"]) {
      expect(firstIssue(withLines([{ ...line, referenceId }]))).toBe("Elige el producto de cada línea.");
    }
  });

  it("requires tons above zero", () => {
    for (const tons of ["", "0", "abc"]) {
      expect(firstIssue(withLines([{ ...line, tons }]))).toBe("Las toneladas de cada producto deben ser un número mayor que cero.");
    }
  });

  it("accepts a zero cost but not a blank or negative one", () => {
    expect(loadSchema.parse(withLines([{ ...line, cost: "0" }])).lines[0]?.cost).toBe(0);
    expect(firstIssue(withLines([{ ...line, cost: "" }]))).toBe("Ingresa el costo en pesos de cada producto.");
    expect(loadSchema.safeParse(withLines([{ ...line, cost: "-5" }])).success).toBe(false);
    expect(loadSchema.safeParse(withLines([{ ...line, cost: "abc" }])).success).toBe(false);
  });

  it("requires the SIESA and the order numbers of each line", () => {
    expect(firstIssue(withLines([{ ...line, siesaNumber: "  " }]))).toBe("Ingresa el número SIESA de cada producto.");
    expect(firstIssue(withLines([{ ...line, orderNumber: "" }]))).toBe("Ingresa el número de pedido de cada producto.");
  });

  it("names a SIESA number repeated inside the same load", () => {
    const issue = firstIssue(withLines([line, { ...line, referenceId: 11 }]));
    expect(issue).toBe("El número SIESA FV-100 está repetido en el cargue.");
  });

  it("allows the same product on two lines with different SIESA numbers", () => {
    expect(loadSchema.safeParse(withLines([line, { ...line, siesaNumber: "FV-101" }])).success).toBe(true);
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
