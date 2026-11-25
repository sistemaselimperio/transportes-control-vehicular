import { describe, expect, it } from "vitest";
import {
  addParkedTripCounts,
  parkedTripWarnings,
  type ParkedTripVehicle,
  type ParkedTripInput,
} from "./parked-trips";

const NOW = new Date("2026-10-17T15:00:00Z");

function trip(p: Partial<ParkedTripInput> & { id: number }): ParkedTripInput {
  return {
    startAt: "2026-10-18T13:00:00Z",
    origin: "Cota",
    destination: "Bogotá",
    plate: "AAA-111",
    vehicleId: 1,
    status: "programado",
    ...p,
  };
}

const vehicles: ParkedTripVehicle[] = [
  { id: 1, plate: "AAA-111", status: "IDLE", ownerGroup: "IMPERIO" },
  { id: 2, plate: "BBB-222", status: "IN_WORKSHOP", ownerGroup: "PAEZ" },
  { id: 3, plate: "CCC-333", status: "ACTIVE", ownerGroup: "IMPERIO" },
  { id: 4, plate: "DDD-444", status: "SOLD", ownerGroup: null },
];

describe("parkedTripWarnings", () => {
  it("warns about a programmed trip of an idle or in-workshop vehicle", () => {
    const out = parkedTripWarnings([trip({ id: 1 }), trip({ id: 2, vehicleId: 2, plate: "BBB-222" })], vehicles, NOW);
    expect(out).toEqual([
      {
        tripId: 1,
        vehicleId: 1,
        plate: "AAA-111",
        startAt: "2026-10-18T13:00:00Z",
        origin: "Cota",
        destination: "Bogotá",
        vehicleStatus: "IDLE",
        ownerGroup: "IMPERIO",
      },
      expect.objectContaining({ tripId: 2, vehicleStatus: "IN_WORKSHOP", ownerGroup: "PAEZ" }),
    ]);
  });

  it("ignores active and sold vehicles", () => {
    const out = parkedTripWarnings(
      [trip({ id: 1, vehicleId: 3, plate: "CCC-333" }), trip({ id: 2, vehicleId: 4, plate: "DDD-444" })],
      vehicles,
      NOW,
    );
    expect(out).toEqual([]);
  });

  it("ignores delivered trips, including programmed ones whose start was 12 hours ago", () => {
    const out = parkedTripWarnings(
      [trip({ id: 1, status: "entregado" }), trip({ id: 2, startAt: "2026-10-17T02:00:00Z" })],
      vehicles,
      NOW,
    );
    expect(out).toEqual([]);
  });

  it("keeps a programmed trip that started less than 12 hours ago", () => {
    const out = parkedTripWarnings([trip({ id: 1, startAt: "2026-10-17T10:00:00Z" })], vehicles, NOW);
    expect(out.map((w) => w.tripId)).toEqual([1]);
  });

  it("ignores trips without a fleet vehicle or whose vehicle is unknown", () => {
    const out = parkedTripWarnings([trip({ id: 1, vehicleId: null }), trip({ id: 2, vehicleId: 99 })], vehicles, NOW);
    expect(out).toEqual([]);
  });

  it("uses the vehicle's current plate and lists the soonest trip first", () => {
    const out = parkedTripWarnings(
      [trip({ id: 1, startAt: "2026-10-20T13:00:00Z", plate: "OLD-000" }), trip({ id: 2, startAt: "2026-10-18T13:00:00Z" })],
      vehicles,
      NOW,
    );
    expect(out.map((w) => w.tripId)).toEqual([2, 1]);
    expect(out.find((w) => w.tripId === 1)?.plate).toBe("AAA-111");
  });

  it("disappears once the vehicle is active again", () => {
    const active = vehicles.map((v) => (v.id === 1 ? { ...v, status: "ACTIVE" as const } : v));
    expect(parkedTripWarnings([trip({ id: 1 })], active, NOW)).toEqual([]);
  });
});

describe("addParkedTripCounts", () => {
  const counts = { ALL: 3, IMPERIO: 2, PAEZ: 1, THIRD_PARTY: 0 };
  const warnings = parkedTripWarnings(
    [trip({ id: 1 }), trip({ id: 2, vehicleId: 2, plate: "BBB-222" })],
    vehicles,
    NOW,
  );

  it("adds each warning to the fleet total and to its owner group", () => {
    expect(addParkedTripCounts(counts, warnings)).toEqual({ ALL: 5, IMPERIO: 3, PAEZ: 2, THIRD_PARTY: 0 });
  });

  it("counts a vehicle with several programmed trips once", () => {
    const twice = parkedTripWarnings(
      [trip({ id: 1 }), trip({ id: 5, startAt: "2026-10-19T13:00:00Z" })],
      vehicles,
      NOW,
    );
    expect(twice).toHaveLength(2);
    expect(addParkedTripCounts(counts, twice)).toEqual({ ALL: 4, IMPERIO: 3, PAEZ: 1, THIRD_PARTY: 0 });
  });

  it("leaves the counts alone without warnings", () => {
    expect(addParkedTripCounts(counts, [])).toEqual(counts);
  });
});
