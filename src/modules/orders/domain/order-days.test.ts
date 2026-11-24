import { describe, expect, it } from "vitest";
import type { OrderLineRow, OrderRow } from "./order-rules";
import { bucketPendingOrders, clientNames, daysLate, sortOrdersForList } from "./order-days";

const line = (over: Partial<OrderLineRow>): OrderLineRow => ({
  id: 1,
  clientId: 1,
  clientName: "Agro Ñandú",
  locationId: null,
  locationName: null,
  referenceId: 1,
  referenceName: "Urea",
  referenceCode: "U01",
  bags: 10,
  ...over,
});

const order = (over: Partial<OrderRow>): OrderRow => ({
  id: 1,
  deliveryDate: "2026-11-24",
  timeWindow: null,
  note: null,
  status: "pendiente",
  loadId: null,
  lines: [line({})],
  ...over,
});

const today = "2026-11-24";

describe("bucketPendingOrders", () => {
  it("splits the orders into late, today, tomorrow and later, oldest first and by number within a day", () => {
    const b = bucketPendingOrders(
      [
        order({ id: 5, deliveryDate: "2026-11-27" }),
        order({ id: 6, deliveryDate: "2026-11-26" }),
        order({ id: 4, deliveryDate: today }),
        order({ id: 2, deliveryDate: today }),
        order({ id: 3, deliveryDate: "2026-11-25" }),
        order({ id: 1, deliveryDate: "2026-11-20" }),
      ],
      today,
    );
    expect(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.map((o) => o.id)]))).toEqual({
      atrasado: [1],
      hoy: [2, 4],
      manana: [3],
      despues: [6, 5],
    });
  });

  it("keeps every bucket, empty ones included", () => {
    expect(bucketPendingOrders([], today)).toEqual({ atrasado: [], hoy: [], manana: [], despues: [] });
  });
});

describe("daysLate", () => {
  it("counts whole days past the delivery date, zero when not late", () => {
    expect(daysLate("2026-11-20", today)).toBe(4);
    expect(daysLate(today, today)).toBe(0);
    expect(daysLate("2026-11-25", today)).toBe(0);
  });
});

describe("clientNames", () => {
  it("lists each client once, in line order", () => {
    const o = order({
      lines: [
        line({ id: 1, clientId: 2, clientName: "Finca El Roble" }),
        line({ id: 2, clientId: 1, clientName: "Agro Ñandú" }),
        line({ id: 3, clientId: 2, clientName: "Finca El Roble" }),
      ],
    });
    expect(clientNames(o)).toEqual(["Finca El Roble", "Agro Ñandú"]);
  });
});

describe("sortOrdersForList", () => {
  it("puts pending orders first by delivery day, then loaded and annulled ones newest first", () => {
    const rows = [
      order({ id: 1, status: "cargado", deliveryDate: "2026-11-20" }),
      order({ id: 2, status: "pendiente", deliveryDate: "2026-11-26" }),
      order({ id: 3, status: "anulado", deliveryDate: "2026-11-25" }),
      order({ id: 4, status: "pendiente", deliveryDate: "2026-11-21" }),
      order({ id: 5, status: "cargado", deliveryDate: "2026-11-23" }),
      order({ id: 6, status: "pendiente", deliveryDate: "2026-11-21" }),
    ];
    expect(sortOrdersForList(rows).map((o) => o.id)).toEqual([4, 6, 2, 5, 1, 3]);
  });
});
