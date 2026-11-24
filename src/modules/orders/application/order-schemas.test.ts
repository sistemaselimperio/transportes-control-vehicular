import { describe, expect, it } from "vitest";
import { kgPerBagSchema, orderIdSchema, orderSchema } from "./order-schemas";

const lines = [{ clientId: 3, locationId: 7, referenceId: 12, bags: 50 }];
const valid = { deliveryDate: "2026-11-20", timeWindow: " 7–11 a.m. ", note: "", lines: JSON.stringify(lines) };

describe("orderSchema", () => {
  it("parses a valid form", () => {
    expect(orderSchema.parse(valid)).toEqual({
      deliveryDate: "2026-11-20",
      timeWindow: "7–11 a.m.",
      note: null,
      lines: [{ clientId: 3, locationId: 7, referenceId: 12, bags: 50 }],
    });
  });

  it("requires a valid delivery date", () => {
    const r = orderSchema.safeParse({ ...valid, deliveryDate: "" });
    expect(r.success).toBe(false);
  });

  it("requires at least one line", () => {
    const r = orderSchema.safeParse({ ...valid, lines: "[]" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Agrega al menos una línea al pedido.");
  });

  it("rejects lines that are not valid JSON", () => {
    const r = orderSchema.safeParse({ ...valid, lines: "{oops" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Las líneas del pedido no son válidas.");
  });

  it("requires a client, a catalog product and positive whole bags on every line", () => {
    const bad = (over: object) => orderSchema.safeParse({ ...valid, lines: JSON.stringify([{ ...lines[0], ...over }]) });
    expect(bad({ clientId: null }).success).toBe(false);
    for (const referenceId of [null, 0, -1, 1.5, "12", undefined]) expect(bad({ referenceId }).success).toBe(false);
    for (const bags of [0, -3, 1.5, null]) expect(bad({ bags }).success).toBe(false);
  });

  it("makes the finca optional", () => {
    const r = orderSchema.parse({ ...valid, lines: JSON.stringify([{ ...lines[0], locationId: null }]) });
    expect(r.lines[0]?.locationId).toBeNull();
    const omitted = orderSchema.parse({ ...valid, lines: JSON.stringify([{ clientId: 3, referenceId: 5, bags: 1 }]) });
    expect(omitted.lines[0]?.locationId).toBeNull();
  });

  it("caps the note and the time window", () => {
    expect(orderSchema.safeParse({ ...valid, note: "x".repeat(501) }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, timeWindow: "x".repeat(41) }).success).toBe(false);
  });
});

describe("kgPerBagSchema", () => {
  it("parses a positive decimal", () => {
    expect(kgPerBagSchema.parse("40")).toBe(40);
    expect(kgPerBagSchema.parse("42,5")).toBe(42.5);
  });

  it("rejects blank, zero, negative text and absurd values", () => {
    for (const v of ["", "0", "abc", "-5", "5000"]) expect(kgPerBagSchema.safeParse(v).success).toBe(false);
  });
});

describe("orderIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(orderIdSchema.safeParse(4).success).toBe(true);
    expect(orderIdSchema.safeParse(0).success).toBe(false);
    expect(orderIdSchema.safeParse("4").success).toBe(false);
  });
});
