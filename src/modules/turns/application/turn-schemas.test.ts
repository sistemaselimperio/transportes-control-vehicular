import { describe, expect, it } from "vitest";
import { createDaySchema, enturnSchema, idSchema, windowTimesSchema } from "./turn-schemas";

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
  it("coerces the ids and keeps the destination optional", () => {
    expect(enturnSchema.parse({ turnDayId: "3", vehicleId: "5", destination: "" })).toEqual({ turnDayId: 3, vehicleId: 5, destination: "" });
    expect(enturnSchema.parse({ turnDayId: "3", vehicleId: "5" }).destination).toBe("");
  });
  it("requires a vehicle", () => {
    expect(enturnSchema.safeParse({ turnDayId: "3", vehicleId: "" }).success).toBe(false);
  });
  it("caps the destination", () => {
    expect(enturnSchema.safeParse({ turnDayId: 3, vehicleId: 5, destination: "x".repeat(201) }).success).toBe(false);
  });
});

describe("idSchema", () => {
  it("accepts a positive integer only", () => {
    expect(idSchema.parse(4)).toBe(4);
    expect(idSchema.safeParse(0).success).toBe(false);
    expect(idSchema.safeParse(1.5).success).toBe(false);
  });
});
