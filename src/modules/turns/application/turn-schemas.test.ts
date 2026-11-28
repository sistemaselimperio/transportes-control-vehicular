import { describe, expect, it } from "vitest";
import { assignSchema, createDaySchema, enturnSchema, idSchema, updateTurnSchema, windowTimesSchema } from "./turn-schemas";

describe("windowTimesSchema", () => {
  it("accepts HH:mm times", () => {
    expect(windowTimesSchema.parse({ opensTime: "06:00", closesTime: "18:30" })).toEqual({ opensTime: "06:00", closesTime: "18:30" });
  });
  it("rejects a malformed time", () => {
    expect(windowTimesSchema.safeParse({ opensTime: "6am", closesTime: "18:30" }).success).toBe(false);
    expect(windowTimesSchema.safeParse({ opensTime: "06:00", closesTime: "" }).success).toBe(false);
  });
});

describe("createDaySchema", () => {
  it("requires a valid date", () => {
    expect(createDaySchema.safeParse({ date: "2026-13-40", opensTime: "06:00", closesTime: "18:00" }).success).toBe(false);
    expect(createDaySchema.parse({ date: "2026-11-27", opensTime: "06:00", closesTime: "18:00" }).date).toBe("2026-11-27");
  });
});

describe("enturnSchema", () => {
  const valid = { turnDayId: "3", product: "  Cemento ", destination: " Finca La Esperanza ", neededTime: "07:30" };

  it("coerces the id and trims the texts", () => {
    expect(enturnSchema.parse(valid)).toEqual({ turnDayId: 3, product: "Cemento", destination: "Finca La Esperanza", neededTime: "07:30" });
  });
  it("requires product, place and a valid hour", () => {
    expect(enturnSchema.safeParse({ ...valid, product: "  " }).success).toBe(false);
    expect(enturnSchema.safeParse({ ...valid, destination: "" }).success).toBe(false);
    expect(enturnSchema.safeParse({ ...valid, neededTime: "25:00" }).success).toBe(false);
    expect(enturnSchema.safeParse({ ...valid, neededTime: undefined }).success).toBe(false);
  });
  it("caps product and place", () => {
    expect(enturnSchema.safeParse({ ...valid, product: "x".repeat(201) }).success).toBe(false);
    expect(enturnSchema.safeParse({ ...valid, destination: "x".repeat(201) }).success).toBe(false);
  });
  it("takes an optional vehicle for admins, blank meaning none", () => {
    expect(enturnSchema.parse({ ...valid, vehicleId: "5" }).vehicleId).toBe(5);
    expect(enturnSchema.parse({ ...valid, vehicleId: "" }).vehicleId).toBeUndefined();
    expect(enturnSchema.safeParse({ ...valid, vehicleId: "abc" }).success).toBe(false);
  });
});

describe("updateTurnSchema", () => {
  it("takes product, place and hour", () => {
    expect(updateTurnSchema.parse({ product: "Arena", destination: "Obra", neededTime: "14:00" })).toEqual({
      product: "Arena",
      destination: "Obra",
      neededTime: "14:00",
    });
    expect(updateTurnSchema.safeParse({ product: "", destination: "Obra", neededTime: "14:00" }).success).toBe(false);
  });
});

describe("assignSchema", () => {
  it("accepts a vehicle id or null to unassign", () => {
    expect(assignSchema.parse(4)).toBe(4);
    expect(assignSchema.parse(null)).toBeNull();
    expect(assignSchema.safeParse(0).success).toBe(false);
  });
});

describe("idSchema", () => {
  it("accepts a positive integer only", () => {
    expect(idSchema.parse(4)).toBe(4);
    expect(idSchema.safeParse(0).success).toBe(false);
    expect(idSchema.safeParse(1.5).success).toBe(false);
  });
});
