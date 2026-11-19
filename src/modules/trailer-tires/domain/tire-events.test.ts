import { describe, expect, it } from "vitest";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import {
  assertTrailerVehicle,
  assertValidTireEvent,
  currentPositionState,
  eventPrice,
  eventsOfPosition,
  summarizeEvent,
  type TireEventRow,
  type TireEventValues,
} from "./tire-events";

const base = { date: "2026-10-01", position: "E1-I-EXT" as const, provider: null, price: null, notes: null };

const change: TireEventValues = { ...base, type: "CHANGE", reference: "295/80R22.5 Doublecoin" };
const repair: TireEventValues = { ...base, type: "REPAIR", notes: "Parche por pinchazo" };
const rotation: TireEventValues = { ...base, type: "ROTATION", counterpart: "E2-I-EXT" };
const inspection: TireEventValues = {
  ...base,
  type: "INSPECTION",
  treadDepthMm: 8.5,
  pressurePsi: null,
  condition: null,
};

describe("assertTrailerVehicle", () => {
  it("accepts a trailer", () => {
    expect(() => assertTrailerVehicle(true)).not.toThrow();
  });

  it("rejects any other vehicle", () => {
    expect(() => assertTrailerVehicle(false)).toThrow(RuleError);
  });
});

describe("assertValidTireEvent", () => {
  it("accepts one valid event of each type", () => {
    for (const event of [change, repair, rotation, inspection]) {
      expect(() => assertValidTireEvent(event)).not.toThrow();
    }
  });

  it("rejects an unknown position", () => {
    expect(() => assertValidTireEvent({ ...change, position: "E9-I-EXT" as never })).toThrow(/posición/i);
  });

  it("requires the tire reference on a change", () => {
    expect(() => assertValidTireEvent({ ...change, reference: "  " })).toThrow(/referencia/i);
  });

  it("requires a description on a repair", () => {
    expect(() => assertValidTireEvent({ ...repair, notes: null })).toThrow(/reparación/i);
    expect(() => assertValidTireEvent({ ...repair, notes: "   " })).toThrow(/reparación/i);
  });

  it("requires two different positions on a rotation", () => {
    expect(() => assertValidTireEvent({ ...rotation, counterpart: "E1-I-EXT" })).toThrow(/distintas/i);
    expect(() => assertValidTireEvent({ ...rotation, counterpart: "E9-D-INT" as never })).toThrow(/posición/i);
  });

  it("requires a measurement or a condition on an inspection", () => {
    expect(() =>
      assertValidTireEvent({ ...inspection, treadDepthMm: null, pressurePsi: null, condition: null }),
    ).toThrow(/medición|estado/i);
    expect(() => assertValidTireEvent({ ...inspection, treadDepthMm: null, condition: "BAD" })).not.toThrow();
    expect(() => assertValidTireEvent({ ...inspection, treadDepthMm: null, pressurePsi: 95 })).not.toThrow();
    expect(() => assertValidTireEvent({ ...inspection, treadDepthMm: 0 })).not.toThrow();
  });
});

const row = (id: number, values: TireEventValues): TireEventRow => ({ id, ...values }) as TireEventRow;

describe("eventsOfPosition", () => {
  const events = [
    row(1, { ...change, position: "E1-I-EXT", date: "2026-01-10" }),
    row(2, { ...repair, position: "E2-D-INT", date: "2026-02-10" }),
    row(3, { ...rotation, position: "E1-I-EXT", counterpart: "E2-D-INT", date: "2026-03-10" }),
    row(4, { ...inspection, position: "E3-I-INT", date: "2026-04-10" }),
  ];

  it("lists the events of the position, most recent first", () => {
    expect(eventsOfPosition(events, "E1-I-EXT").map((e) => e.id)).toEqual([3, 1]);
  });

  it("includes a rotation in the history of both positions", () => {
    expect(eventsOfPosition(events, "E2-D-INT").map((e) => e.id)).toEqual([3, 2]);
  });

  it("breaks date ties by the newest id", () => {
    const tied = [row(5, { ...change, date: "2026-05-01" }), row(6, { ...repair, date: "2026-05-01" })];
    expect(eventsOfPosition(tied, "E1-I-EXT").map((e) => e.id)).toEqual([6, 5]);
  });

  it("is empty for a position without events", () => {
    expect(eventsOfPosition(events, "E3-D-EXT")).toEqual([]);
  });
});

describe("currentPositionState", () => {
  it("is null when the position has no events", () => {
    expect(currentPositionState([], "E1-I-EXT")).toBeNull();
  });

  it("is the latest event that involves the position", () => {
    const events = [row(1, { ...change, date: "2026-01-10" }), row(2, { ...repair, date: "2026-02-10" })];
    expect(currentPositionState(events, "E1-I-EXT")?.id).toBe(2);
  });
});

describe("summarizeEvent", () => {
  it("describes a change by its reference", () => {
    expect(summarizeEvent(row(1, change), "E1-I-EXT")).toEqual({
      title: "Cambio de llanta",
      detail: "295/80R22.5 Doublecoin",
    });
  });

  it("describes a repair by its notes", () => {
    expect(summarizeEvent(row(1, repair), "E1-I-EXT")).toEqual({
      title: "Reparación",
      detail: "Parche por pinchazo",
    });
  });

  it("names the other position of a rotation, seen from either side", () => {
    const event = row(1, rotation);
    expect(summarizeEvent(event, "E1-I-EXT").detail).toBe("Con Eje 2 · Izquierda · Exterior");
    expect(summarizeEvent(event, "E2-I-EXT").detail).toBe("Con Eje 1 · Izquierda · Exterior");
  });

  it("lists the measurements and the condition of an inspection", () => {
    const full = row(1, { ...inspection, treadDepthMm: 8.5, pressurePsi: 95, condition: "FAIR" });
    expect(summarizeEvent(full, "E1-I-EXT")).toEqual({
      title: "Inspección",
      detail: "Regular · 8,5 mm · 95 psi",
    });
    expect(summarizeEvent(row(2, { ...inspection, treadDepthMm: null, pressurePsi: 100 }), "E1-I-EXT").detail).toBe(
      "100 psi",
    );
  });
});

describe("eventPrice", () => {
  it("is the price of changes and repairs, null for every other event", () => {
    expect(eventPrice(row(1, { ...change, price: 900000 }))).toBe(900000);
    expect(eventPrice(row(2, { ...repair, price: 50000 }))).toBe(50000);
    expect(eventPrice(row(3, rotation))).toBeNull();
    expect(eventPrice(row(4, inspection))).toBeNull();
  });
});
