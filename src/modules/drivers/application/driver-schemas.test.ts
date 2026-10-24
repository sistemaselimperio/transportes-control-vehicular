import { describe, expect, it } from "vitest";
import { driverIdSchema, driverSchema } from "./driver-schemas";

describe("driverSchema", () => {
  it("normalizes the raw form values", () => {
    expect(
      driverSchema.parse({
        name: "  pérez   gómez juan ",
        nationalId: "1.053.350.927",
        phone: "+57 320 429 8346",
        company: "IMPERIO",
        status: "IN_WORKSHOP",
      }),
    ).toEqual({
      name: "Pérez Gómez Juan",
      nationalId: "1053350927",
      phone: "3204298346",
      company: "IMPERIO",
      status: "IN_WORKSHOP",
    });
  });

  it("treats blank optional fields as not provided", () => {
    expect(driverSchema.parse({ name: "Juan", nationalId: "", phone: " ", company: "", status: "ACTIVE" })).toEqual({
      name: "Juan",
      nationalId: null,
      phone: null,
      company: null,
      status: "ACTIVE",
    });
  });

  it("requires a name", () => {
    expect(() => driverSchema.parse({ name: "  ", status: "ACTIVE" })).toThrow("Ingresa el nombre");
  });

  it("rejects a national ID with letters", () => {
    expect(() => driverSchema.parse({ name: "Juan", nationalId: "12a45", status: "ACTIVE" })).toThrow("cédula");
  });

  it("rejects a phone that is not a 10-digit Colombian number", () => {
    expect(() => driverSchema.parse({ name: "Juan", phone: "12345", status: "ACTIVE" })).toThrow("celular");
  });

  it("rejects an unknown status or company", () => {
    expect(() => driverSchema.parse({ name: "Juan", status: "SOLD" })).toThrow();
    expect(() => driverSchema.parse({ name: "Juan", company: "OTRA", status: "ACTIVE" })).toThrow();
  });
});

describe("driverIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(driverIdSchema.parse(5)).toBe(5);
    expect(() => driverIdSchema.parse(0)).toThrow();
    expect(() => driverIdSchema.parse(1.5)).toThrow();
  });
});
