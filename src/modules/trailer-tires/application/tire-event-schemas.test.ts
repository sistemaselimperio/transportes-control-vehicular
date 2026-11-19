import { describe, expect, it } from "vitest";
import { tireEventSchema } from "./tire-event-schemas";

const base = { date: "2026-05-10", position: "E1-I-EXT" };

describe("tireEventSchema", () => {
  it("parses a change and normalizes the raw form values", () => {
    expect(
      tireEventSchema.parse({
        ...base,
        type: "CHANGE",
        reference: "  295/80R22.5 ",
        provider: " Llantas SA ",
        price: "1.250.000",
        notes: " ",
      }),
    ).toEqual({
      ...base,
      type: "CHANGE",
      reference: "295/80R22.5",
      provider: "Llantas SA",
      price: 1_250_000,
      notes: null,
    });
  });

  it("requires the reference on a change", () => {
    expect(() => tireEventSchema.parse({ ...base, type: "CHANGE", reference: " " })).toThrow(/referencia/i);
  });

  it("parses a repair and requires its description", () => {
    expect(tireEventSchema.parse({ ...base, type: "REPAIR", notes: "Parche" })).toMatchObject({
      type: "REPAIR",
      notes: "Parche",
      provider: null,
      price: null,
    });
    expect(() => tireEventSchema.parse({ ...base, type: "REPAIR", notes: "" })).toThrow(/reparación/i);
  });

  it("parses a rotation with its counterpart position", () => {
    expect(tireEventSchema.parse({ ...base, type: "ROTATION", counterpart: "E2-D-INT" })).toMatchObject({
      type: "ROTATION",
      counterpart: "E2-D-INT",
    });
    expect(() => tireEventSchema.parse({ ...base, type: "ROTATION", counterpart: "E9-D-INT" })).toThrow(/posición/i);
  });

  it("parses an inspection with comma decimals and an optional condition", () => {
    expect(
      tireEventSchema.parse({ ...base, type: "INSPECTION", treadDepthMm: "8,5", pressurePsi: "95", condition: "GOOD" }),
    ).toMatchObject({ type: "INSPECTION", treadDepthMm: 8.5, pressurePsi: 95, condition: "GOOD" });
    expect(tireEventSchema.parse({ ...base, type: "INSPECTION", condition: "" })).toMatchObject({
      treadDepthMm: null,
      pressurePsi: null,
      condition: null,
    });
  });

  it("rejects malformed measurements and conditions", () => {
    expect(() => tireEventSchema.parse({ ...base, type: "INSPECTION", treadDepthMm: "abc" })).toThrow(/profundidad/i);
    expect(() => tireEventSchema.parse({ ...base, type: "INSPECTION", pressurePsi: "-5" })).toThrow(/presión/i);
    expect(() => tireEventSchema.parse({ ...base, type: "INSPECTION", condition: "TERRIBLE" })).toThrow(/estado/i);
  });

  it("rejects an unknown event type, position or date", () => {
    expect(() => tireEventSchema.parse({ ...base, type: "WASH" })).toThrow();
    expect(() => tireEventSchema.parse({ ...base, position: "E9-I-EXT", type: "REPAIR", notes: "x" })).toThrow(/posición/i);
    expect(() => tireEventSchema.parse({ ...base, date: "10/05/2026", type: "REPAIR", notes: "x" })).toThrow(/fecha/i);
  });
});
