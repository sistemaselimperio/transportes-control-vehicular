import { describe, expect, it } from "vitest";
import {
  ALERT_THRESHOLD_DAYS,
  computeClientAlerts,
  filterDeliveries,
  groupByShift,
  isDeliveryShift,
  isSunday,
  sortDeliveries,
  summarizeByDestination,
  tonsFromKg,
  totalsOf,
  type DeliveryRow,
} from "./delivery-rules";

const row = (over: Partial<DeliveryRow>): DeliveryRow => ({
  id: 1,
  date: "2026-11-18",
  shift: "1er viaje",
  priority: "normal",
  clientId: 1,
  clientName: "Agro Ñandú",
  clientNit: "9001234567",
  locationId: null,
  locationName: null,
  destinationId: 1,
  destinationName: "Susa",
  quantity: 10,
  weightKg: 500,
  status: "pendiente",
  plate: null,
  vehicleId: null,
  notes: null,
  ...over,
});

describe("tonsFromKg", () => {
  it("derives tons from the typed kilograms", () => {
    expect(tonsFromKg(1500)).toBe(1.5);
    expect(tonsFromKg(250)).toBe(0.25);
  });
});

describe("isSunday", () => {
  it("flags Sundays only", () => {
    expect(isSunday("2026-11-22")).toBe(true);
    expect(isSunday("2026-11-21")).toBe(false);
    expect(isSunday("2026-11-23")).toBe(false);
  });

  it("is false for anything that is not a date", () => {
    expect(isSunday("")).toBe(false);
    expect(isSunday("mañana")).toBe(false);
  });
});

describe("isDeliveryShift", () => {
  it("knows the three shifts", () => {
    expect(isDeliveryShift("2do viaje")).toBe(true);
    expect(isDeliveryShift("4to viaje")).toBe(false);
  });
});

describe("totalsOf", () => {
  it("adds bags and kilograms and derives the tons", () => {
    expect(totalsOf([row({ quantity: 10, weightKg: 500 }), row({ id: 2, quantity: 5, weightKg: 1000.5 })])).toEqual({
      count: 2,
      quantity: 15,
      weightKg: 1500.5,
      tons: 1.5005,
    });
  });

  it("is all zeros for no rows", () => {
    expect(totalsOf([])).toEqual({ count: 0, quantity: 0, weightKg: 0, tons: 0 });
  });
});

describe("sortDeliveries", () => {
  it("puts urgent first, then the oldest registered", () => {
    const sorted = sortDeliveries([
      row({ id: 3 }),
      row({ id: 2, priority: "urgente" }),
      row({ id: 1 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual([2, 1, 3]);
  });
});

describe("groupByShift", () => {
  it("always returns the three shifts in order, with their totals", () => {
    const groups = groupByShift([
      row({ id: 1, shift: "2do viaje", quantity: 4, weightKg: 200 }),
      row({ id: 2, shift: "1er viaje", priority: "urgente" }),
      row({ id: 3, shift: "1er viaje" }),
    ]);
    expect(groups.map((g) => g.shift)).toEqual(["1er viaje", "2do viaje", "3er viaje"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual([2, 3]);
    expect(groups[1].totals).toMatchObject({ count: 1, quantity: 4, weightKg: 200 });
    expect(groups[2].rows).toEqual([]);
  });
});

describe("filterDeliveries", () => {
  const rows = [
    row({ id: 1, date: "2026-11-10", clientName: "Agro Ñandú", clientNit: "9001234567", destinationId: 1, shift: "1er viaje" }),
    row({ id: 2, date: "2026-11-15", clientName: "Lácteos Susa", clientNit: "800555111", destinationId: 2, shift: "2do viaje" }),
    row({ id: 3, date: "2026-11-20", clientName: "Agro Ñandú", clientNit: "9001234567", destinationId: 2, shift: "3er viaje" }),
  ];
  const none = { query: "", destinationId: null, shift: null, from: null, to: null };

  it("keeps everything without filters", () => {
    expect(filterDeliveries(rows, none)).toHaveLength(3);
  });

  it("filters by client name or NIT", () => {
    expect(filterDeliveries(rows, { ...none, query: "nandu" }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterDeliveries(rows, { ...none, query: "800555" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by destination and shift", () => {
    expect(filterDeliveries(rows, { ...none, destinationId: 2 }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterDeliveries(rows, { ...none, shift: "2do viaje" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by an inclusive date range", () => {
    expect(filterDeliveries(rows, { ...none, from: "2026-11-15", to: "2026-11-20" }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterDeliveries(rows, { ...none, from: "2026-11-16" }).map((r) => r.id)).toEqual([3]);
    expect(filterDeliveries(rows, { ...none, to: "2026-11-14" }).map((r) => r.id)).toEqual([1]);
  });
});

describe("summarizeByDestination", () => {
  it("groups by destination with count, bags, kilograms and tons, heaviest first", () => {
    const summary = summarizeByDestination([
      row({ id: 1, destinationId: 1, destinationName: "Susa", quantity: 10, weightKg: 500 }),
      row({ id: 2, destinationId: 2, destinationName: "Ubaté", quantity: 40, weightKg: 2000 }),
      row({ id: 3, destinationId: 1, destinationName: "Susa", quantity: 5, weightKg: 250 }),
    ]);
    expect(summary).toEqual([
      { destinationId: 2, destinationName: "Ubaté", count: 1, quantity: 40, weightKg: 2000, tons: 2 },
      { destinationId: 1, destinationName: "Susa", count: 2, quantity: 15, weightKg: 750, tons: 0.75 },
    ]);
  });
});

describe("computeClientAlerts", () => {
  const today = "2026-11-19";

  it("uses a fixed 13-day threshold", () => {
    expect(ALERT_THRESHOLD_DAYS).toBe(13);
  });

  it("alerts clients whose last delivery is 13 or more days old, most overdue first", () => {
    const alerts = computeClientAlerts(
      [
        { id: 1, name: "Reciente", nit: null, lastDeliveryDate: "2026-11-10" },
        { id: 2, name: "Justo", nit: null, lastDeliveryDate: "2026-11-06" },
        { id: 3, name: "Muy atrasado", nit: "123456", lastDeliveryDate: "2026-09-01" },
        { id: 4, name: "Atrasado", nit: null, lastDeliveryDate: "2026-10-20" },
      ],
      today,
    );
    expect(alerts.map((a) => [a.id, a.daysSince])).toEqual([
      [3, 79],
      [4, 30],
      [2, 13],
    ]);
  });

  it("does not alert 12 days", () => {
    expect(computeClientAlerts([{ id: 1, name: "A", nit: null, lastDeliveryDate: "2026-11-07" }], today)).toEqual([]);
  });

  it("does not alert clients without deliveries", () => {
    expect(computeClientAlerts([{ id: 1, name: "Nuevo", nit: null, lastDeliveryDate: null }], today)).toEqual([]);
  });

  it("does not alert a client whose last delivery is still ahead", () => {
    expect(computeClientAlerts([{ id: 1, name: "Futuro", nit: null, lastDeliveryDate: "2026-12-01" }], today)).toEqual([]);
  });

  it("breaks ties by name", () => {
    const alerts = computeClientAlerts(
      [
        { id: 1, name: "Zeta", nit: null, lastDeliveryDate: "2026-10-01" },
        { id: 2, name: "Alfa", nit: null, lastDeliveryDate: "2026-10-01" },
      ],
      today,
    );
    expect(alerts.map((a) => a.name)).toEqual(["Alfa", "Zeta"]);
  });
});
