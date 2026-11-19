import { describe, expect, it } from "vitest";
import { deliveryIdSchema, deliverySchema, destinationSchema, deliveryStatusSchema } from "./delivery-schemas";

const valid = {
  date: "2026-11-18",
  shift: "2do viaje",
  priority: "urgente",
  clientId: "4",
  destinationId: "7",
  quantity: "40",
  weightKg: "2000,5",
  plate: "abc 123",
  notes: " dejar en la bodega ",
};

describe("deliverySchema", () => {
  it("parses a valid form", () => {
    expect(deliverySchema.parse(valid)).toEqual({
      date: "2026-11-18",
      shift: "2do viaje",
      priority: "urgente",
      clientId: 4,
      destinationId: 7,
      quantity: 40,
      weightKg: 2000.5,
      plate: "ABC-123",
      notes: "dejar en la bodega",
    });
  });

  it("defaults the priority to normal and the optional fields to null", () => {
    const parsed = deliverySchema.parse({ ...valid, priority: "", plate: "", notes: undefined });
    expect(parsed.priority).toBe("normal");
    expect(parsed.plate).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("requires a valid date", () => {
    expect(deliverySchema.safeParse({ ...valid, date: "" }).success).toBe(false);
    expect(deliverySchema.safeParse({ ...valid, date: "2026-13-40" }).success).toBe(false);
  });

  it("requires a known shift", () => {
    const r = deliverySchema.safeParse({ ...valid, shift: "4to viaje" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Elige el turno.");
  });

  it("requires a client and a destination", () => {
    const client = deliverySchema.safeParse({ ...valid, clientId: "" });
    expect(!client.success && client.error.issues[0]?.message).toBe("Elige el cliente.");
    const destination = deliverySchema.safeParse({ ...valid, destinationId: "abc" });
    expect(!destination.success && destination.error.issues[0]?.message).toBe("Elige el destino.");
  });

  it("requires a positive whole number of bags", () => {
    for (const quantity of ["", "0", "-3", "2.5", "x"]) {
      const r = deliverySchema.safeParse({ ...valid, quantity });
      expect(r.success).toBe(false);
      expect(!r.success && r.error.issues[0]?.message).toBe("La cantidad de bultos debe ser un número entero mayor que cero.");
    }
  });

  it("requires a positive weight and does not derive it from the bags", () => {
    for (const weightKg of ["", "0", "abc", "-5"]) {
      const r = deliverySchema.safeParse({ ...valid, weightKg });
      expect(r.success).toBe(false);
      expect(!r.success && r.error.issues[0]?.message).toBe("El peso en kg debe ser un número mayor que cero.");
    }
    expect(deliverySchema.parse({ ...valid, quantity: "40", weightKg: "123" }).weightKg).toBe(123);
  });

  it("caps the notes", () => {
    expect(deliverySchema.safeParse({ ...valid, notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("deliveryStatusSchema", () => {
  it("accepts the two statuses", () => {
    expect(deliveryStatusSchema.parse("entregado")).toBe("entregado");
    expect(deliveryStatusSchema.parse("pendiente")).toBe("pendiente");
    expect(deliveryStatusSchema.safeParse("cancelado").success).toBe(false);
  });
});

describe("destinationSchema", () => {
  it("stores the name in title case", () => {
    expect(destinationSchema.parse({ name: " PUENTE de tierra " }).name).toBe("Puente de Tierra");
  });

  it("requires a name", () => {
    expect(destinationSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("deliveryIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(deliveryIdSchema.safeParse(1).success).toBe(true);
    expect(deliveryIdSchema.safeParse(-1).success).toBe(false);
  });
});
