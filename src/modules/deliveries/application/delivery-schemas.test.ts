import { describe, expect, it } from "vitest";
import { deliveryIdSchema, deliverySchema, deliveryStatusSchema } from "./delivery-schemas";

const valid = {
  date: "2026-11-18",
  shift: "2do viaje",
  priority: "urgente",
  clientId: "4",
  destination: "Simijaca (Cundinamarca)",
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
      locationId: null,
      destination: "Simijaca (Cundinamarca)",
      quantity: 40,
      weightKg: 2000.5,
      plate: "ABC-123",
      notes: "dejar en la bodega",
    });
  });

  it("defaults the priority to normal and the notes to null", () => {
    const parsed = deliverySchema.parse({ ...valid, priority: "", notes: undefined });
    expect(parsed.priority).toBe("normal");
    expect(parsed.notes).toBeNull();
  });

  it("requires the vehicle", () => {
    for (const plate of ["", "   ", undefined]) {
      const r = deliverySchema.safeParse({ ...valid, plate });
      expect(!r.success && r.error.issues[0]?.message).toBe("Elige el vehículo.");
    }
  });

  it("takes the optional finca as an id, blank meaning none", () => {
    expect(deliverySchema.parse({ ...valid, locationId: "12" }).locationId).toBe(12);
    expect(deliverySchema.parse({ ...valid, locationId: "" }).locationId).toBeNull();
    const r = deliverySchema.safeParse({ ...valid, locationId: "abc" });
    expect(!r.success && r.error.issues[0]?.message).toBe("La finca no es válida.");
  });

  it("requires a valid date", () => {
    expect(deliverySchema.safeParse({ ...valid, date: "" }).success).toBe(false);
    expect(deliverySchema.safeParse({ ...valid, date: "2026-13-40" }).success).toBe(false);
  });

  it("requires a known shift", () => {
    const r = deliverySchema.safeParse({ ...valid, shift: "4to viaje" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Elige el turno.");
  });

  it("requires a client", () => {
    const client = deliverySchema.safeParse({ ...valid, clientId: "" });
    expect(!client.success && client.error.issues[0]?.message).toBe("Elige el cliente.");
  });

  it("accepts a municipality of Boyacá, Cundinamarca or Santander", () => {
    for (const destination of ["Tunja (Boyacá)", "Villa de San Diego de Ubaté (Cundinamarca)", "Albania (Santander)"]) {
      expect(deliverySchema.parse({ ...valid, destination }).destination).toBe(destination);
    }
  });

  it("rejects a municipality outside those three departments", () => {
    for (const destination of ["Cúcuta (Norte de Santander)", "Bogotá, D.C.", "Medellín (Antioquia)"]) {
      const r = deliverySchema.safeParse({ ...valid, destination });
      expect(!r.success && r.error.issues[0]?.message).toBe("Elige un municipio de Boyacá, Cundinamarca o Santander.");
    }
  });

  it("rejects an empty or free-text destination", () => {
    for (const destination of ["", "   ", undefined, "Simijaca"]) {
      expect(deliverySchema.safeParse({ ...valid, destination }).success).toBe(false);
    }
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

describe("deliveryIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(deliveryIdSchema.safeParse(1).success).toBe(true);
    expect(deliveryIdSchema.safeParse(-1).success).toBe(false);
  });
});
