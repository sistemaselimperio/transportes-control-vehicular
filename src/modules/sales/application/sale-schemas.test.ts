import { describe, expect, it } from "vitest";
import { saleEditSchema, saleIdSchema } from "./sale-schemas";

describe("saleEditSchema", () => {
  it("normalizes the raw form values", () => {
    expect(saleEditSchema.parse({ date: "2024-05-10", buyer: "  Juan ", price: "45.000.000", notes: " " })).toEqual({
      date: "2024-05-10",
      buyer: "Juan",
      price: 45_000_000,
      notes: null,
    });
  });

  it("allows an unknown date and price", () => {
    expect(saleEditSchema.parse({ date: "", buyer: "", price: "", notes: "" })).toEqual({
      date: null,
      buyer: null,
      price: null,
      notes: null,
    });
  });

  it("rejects an invalid date", () => {
    expect(() => saleEditSchema.parse({ date: "2024-13-45" })).toThrow("Fecha de venta");
  });

  it("rejects a price that is not a whole number", () => {
    expect(() => saleEditSchema.parse({ date: "2024-05-10", price: "12a" })).toThrow("El precio");
  });
});

describe("saleIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(saleIdSchema.parse(5)).toBe(5);
    expect(() => saleIdSchema.parse(-1)).toThrow();
  });
});
