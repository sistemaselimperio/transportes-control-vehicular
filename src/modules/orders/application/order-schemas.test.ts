import { describe, expect, it } from "vitest";
import { deliveryDaySchema, deliveryIdsSchema, kgPerBagSchema, MAX_LINES, orderIdSchema, orderSchema } from "./order-schemas";

const payload = { clientId: 3, locationId: 7, lines: [{ referenceId: 12, bags: 50 }] };
const form = (over: object = {}) => JSON.stringify({ ...payload, ...over });
const valid = { deliveryDate: "2026-11-20", timeWindow: " 7–11 a.m. ", note: "", order: form() };

describe("orderSchema", () => {
  it("parses a valid form and writes the client and finca into every line", () => {
    expect(orderSchema.parse(valid)).toEqual({
      deliveryDate: "2026-11-20",
      timeWindow: "7–11 a.m.",
      note: null,
      lines: [{ clientId: 3, locationId: 7, referenceId: 12, bags: 50 }],
    });
    const two = orderSchema.parse({ ...valid, order: form({ lines: [{ referenceId: 1, bags: 2 }, { referenceId: 2, bags: 3 }] }) });
    expect(two.lines.map((l) => [l.clientId, l.locationId, l.referenceId])).toEqual([
      [3, 7, 1],
      [3, 7, 2],
    ]);
  });

  it("requires a valid delivery date", () => {
    const r = orderSchema.safeParse({ ...valid, deliveryDate: "" });
    expect(r.success).toBe(false);
  });

  it("requires at least one product", () => {
    const r = orderSchema.safeParse({ ...valid, order: form({ lines: [] }) });
    expect(!r.success && r.error.issues[0]?.message).toBe("Agrega al menos un producto al pedido.");
  });

  it("rejects a payload that is not valid JSON", () => {
    const r = orderSchema.safeParse({ ...valid, order: "{oops" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Los datos del pedido no son válidos.");
  });

  it("requires the client", () => {
    for (const clientId of [null, 0, "3", undefined]) {
      const r = orderSchema.safeParse({ ...valid, order: form({ clientId }) });
      expect(r.success).toBe(false);
    }
    const r = orderSchema.safeParse({ ...valid, order: form({ clientId: null }) });
    expect(!r.success && r.error.issues[0]?.message).toBe("Elige el cliente del pedido.");
  });

  it("requires a catalog product and positive whole bags on every line", () => {
    const bad = (over: object) => orderSchema.safeParse({ ...valid, order: form({ lines: [{ ...payload.lines[0], ...over }] }) });
    for (const referenceId of [null, 0, -1, 1.5, "12", undefined]) expect(bad({ referenceId }).success).toBe(false);
    for (const bags of [0, -3, 1.5, null]) expect(bad({ bags }).success).toBe(false);
  });

  it("makes the finca optional", () => {
    const r = orderSchema.parse({ ...valid, order: form({ locationId: null }) });
    expect(r.lines[0]?.locationId).toBeNull();
    const omitted = orderSchema.parse({ ...valid, order: JSON.stringify({ clientId: 3, lines: payload.lines }) });
    expect(omitted.lines[0]?.locationId).toBeNull();
  });

  it("rejects the same product twice", () => {
    const r = orderSchema.safeParse({ ...valid, order: form({ lines: [{ referenceId: 1, bags: 2 }, { referenceId: 1, bags: 3 }] }) });
    expect(!r.success && r.error.issues[0]?.message).toBe("Un producto no puede repetirse en el pedido.");
  });

  it("caps the lines", () => {
    const many = Array.from({ length: MAX_LINES + 1 }, (_, i) => ({ referenceId: i + 1, bags: 1 }));
    expect(orderSchema.safeParse({ ...valid, order: form({ lines: many }) }).success).toBe(false);
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

describe("deliveryDaySchema", () => {
  it("accepts an ISO day and refuses anything else", () => {
    expect(deliveryDaySchema.parse("2026-11-25")).toBe("2026-11-25");
    for (const v of ["", "25/11/2026", "2026-13-40", undefined]) expect(deliveryDaySchema.safeParse(v).success).toBe(false);
  });
});

describe("deliveryIdsSchema", () => {
  it("needs at least one positive order number", () => {
    expect(deliveryIdsSchema.parse([13, 14])).toEqual([13, 14]);
    for (const v of [[], [0], ["1"], "13"]) expect(deliveryIdsSchema.safeParse(v).success).toBe(false);
  });
});
