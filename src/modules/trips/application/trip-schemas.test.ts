import { describe, expect, it } from "vitest";
import { tripIdSchema, tripSchema } from "./trip-schemas";

const valid = {
  startAt: "2026-03-10T08:30",
  destination: "  Cúcuta ",
  plate: "abc 123",
  area: "Cemento",
  status: "en_ruta",
};

describe("tripSchema", () => {
  it("parses a valid form", () => {
    const parsed = tripSchema.parse(valid);
    expect(parsed.startAt.toISOString()).toBe("2026-03-10T13:30:00.000Z");
    expect(parsed.destination).toBe("Cúcuta");
    expect(parsed.plate).toBe("ABC-123");
    expect(parsed.area).toBe("Cemento");
    expect(parsed.status).toBe("en_ruta");
  });

  it("defaults the status to programado", () => {
    expect(tripSchema.parse({ ...valid, status: undefined }).status).toBe("programado");
    expect(tripSchema.parse({ ...valid, status: "" }).status).toBe("programado");
  });

  it("requires the start date", () => {
    expect(tripSchema.safeParse({ ...valid, startAt: "" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...valid, startAt: "mañana" }).success).toBe(false);
  });

  it("requires the destination", () => {
    expect(tripSchema.safeParse({ ...valid, destination: "   " }).success).toBe(false);
  });

  it("requires the plate", () => {
    expect(tripSchema.safeParse({ ...valid, plate: "" }).success).toBe(false);
  });

  it("only accepts the fixed areas", () => {
    expect(tripSchema.safeParse({ ...valid, area: "Otra" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...valid, area: "" }).success).toBe(false);
  });

  it("only accepts known statuses", () => {
    expect(tripSchema.safeParse({ ...valid, status: "cancelado" }).success).toBe(false);
  });
});

describe("tripIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(tripIdSchema.safeParse(3).success).toBe(true);
    expect(tripIdSchema.safeParse(0).success).toBe(false);
    expect(tripIdSchema.safeParse(1.5).success).toBe(false);
  });
});
