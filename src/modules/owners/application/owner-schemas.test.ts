import { describe, expect, it } from "vitest";
import { ownerIdSchema, ownerSchema } from "./owner-schemas";

describe("ownerSchema", () => {
  it("normalizes the raw form values", () => {
    expect(ownerSchema.parse({ name: "  pérez   gómez juan ", documentNumber: "1.053.350.927", group: "PAEZ" })).toEqual({
      name: "Pérez Gómez Juan",
      documentNumber: "1053350927",
      group: "PAEZ",
    });
  });

  it("treats a blank document as not provided", () => {
    expect(ownerSchema.parse({ name: "Juan", documentNumber: " ", group: "THIRD_PARTY" }).documentNumber).toBeNull();
  });

  it("requires a name", () => {
    expect(() => ownerSchema.parse({ name: "  ", group: "IMPERIO" })).toThrow("Ingresa el nombre");
  });

  it("rejects a document with letters", () => {
    expect(() => ownerSchema.parse({ name: "Juan", documentNumber: "12a45", group: "IMPERIO" })).toThrow("documento");
  });

  it("rejects a missing or unknown group", () => {
    expect(() => ownerSchema.parse({ name: "Juan" })).toThrow("grupo");
    expect(() => ownerSchema.parse({ name: "Juan", group: "OTRO" })).toThrow("grupo");
  });
});

describe("ownerIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(ownerIdSchema.parse(5)).toBe(5);
    expect(() => ownerIdSchema.parse(0)).toThrow();
  });
});
