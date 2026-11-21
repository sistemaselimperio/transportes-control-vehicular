import { describe, expect, it } from "vitest";
import {
  bagsToKg,
  canEditOrder,
  DEFAULT_KG_PER_BAG,
  DEFAULT_STATUS_FILTER,
  filterOrders,
  isStatusConsistent,
  isValidKgPerBag,
  kgToTons,
  ordersTotals,
  orderTotals,
  tonsDifference,
  unavailableOrderIds,
  type OrderLineRow,
  type OrderRow,
} from "./order-rules";

const line = (over: Partial<OrderLineRow> = {}): OrderLineRow => ({
  id: 1,
  clientId: 1,
  clientName: "Finca Uno",
  locationId: null,
  locationName: null,
  referenceId: 1,
  referenceName: "Engorde",
  bags: 50,
  ...over,
});

const order = (over: Partial<OrderRow> = {}): OrderRow => ({
  id: 1,
  deliveryDate: "2026-11-20",
  timeWindow: null,
  note: null,
  status: "pendiente",
  loadId: null,
  lines: [line()],
  ...over,
});

describe("weights", () => {
  it("derives kg and tons from the bags with the current kg per bag", () => {
    expect(DEFAULT_KG_PER_BAG).toBe(40);
    expect(bagsToKg(50, 40)).toBe(2000);
    expect(kgToTons(2000)).toBe(2);
    expect(bagsToKg(50, 45)).toBe(2250);
  });

  it("does not drift with decimal kg per bag", () => {
    expect(bagsToKg(3, 0.1)).toBe(0.3);
    expect(bagsToKg(7, 40.5)).toBe(283.5);
  });

  it("totals an order and a set of orders", () => {
    const o = order({ lines: [line({ bags: 50 }), line({ id: 2, bags: 25 })] });
    expect(orderTotals(o.lines, 40)).toEqual({ bags: 75, kg: 3000, tons: 3 });
    const all = ordersTotals([o, order({ id: 2, lines: [line({ bags: 25 })] })], 40);
    expect(all).toEqual({ count: 2, bags: 100, kg: 4000, tons: 4 });
  });

  it("recalculates everything when the kg per bag changes", () => {
    const o = order();
    expect(orderTotals(o.lines, 40).tons).toBe(2);
    expect(orderTotals(o.lines, 50).tons).toBe(2.5);
  });
});

describe("kg per bag", () => {
  it("must be a positive finite number", () => {
    expect(isValidKgPerBag(40)).toBe(true);
    expect(isValidKgPerBag(0.5)).toBe(true);
    for (const v of [0, -1, Number.NaN, Infinity, 1001]) expect(isValidKgPerBag(v)).toBe(false);
  });
});

describe("status", () => {
  it("only a pending order can be edited or annulled", () => {
    expect(canEditOrder("pendiente")).toBe(true);
    expect(canEditOrder("cargado")).toBe(false);
    expect(canEditOrder("anulado")).toBe(false);
  });

  it("is loaded exactly when it has a load", () => {
    expect(isStatusConsistent("cargado", 4)).toBe(true);
    expect(isStatusConsistent("cargado", null)).toBe(false);
    expect(isStatusConsistent("pendiente", null)).toBe(true);
    expect(isStatusConsistent("pendiente", 4)).toBe(false);
    expect(isStatusConsistent("anulado", null)).toBe(true);
    expect(isStatusConsistent("anulado", 4)).toBe(false);
  });
});

describe("filterOrders", () => {
  const rows = [
    order({ id: 1, status: "pendiente", deliveryDate: "2026-11-10" }),
    order({ id: 2, status: "cargado", loadId: 3, deliveryDate: "2026-11-15" }),
    order({ id: 3, status: "anulado", deliveryDate: "2026-11-20" }),
  ];

  it("hides annulled orders by default", () => {
    const shown = filterOrders(rows, { statuses: DEFAULT_STATUS_FILTER, from: null, to: null });
    expect(shown.map((r) => r.id)).toEqual([1, 2]);
  });

  it("shows annulled orders when selected", () => {
    const shown = filterOrders(rows, { statuses: ["anulado"], from: null, to: null });
    expect(shown.map((r) => r.id)).toEqual([3]);
  });

  it("filters by an inclusive date range", () => {
    const shown = filterOrders(rows, { statuses: ["pendiente", "cargado", "anulado"], from: "2026-11-15", to: "2026-11-20" });
    expect(shown.map((r) => r.id)).toEqual([2, 3]);
  });
});

describe("tonsDifference", () => {
  it("is entered minus expected, rounded to kilos", () => {
    expect(tonsDifference(31, 30)).toBe(1);
    expect(tonsDifference(29.5, 30)).toBe(-0.5);
    expect(tonsDifference(0.3, 0.1 + 0.2)).toBe(0);
  });
});

describe("unavailableOrderIds", () => {
  const found = [
    { id: 1, status: "pendiente" as const, loadId: null },
    { id: 2, status: "anulado" as const, loadId: null },
    { id: 3, status: "cargado" as const, loadId: 8 },
    { id: 4, status: "cargado" as const, loadId: 9 },
  ];

  it("flags missing, annulled and orders of another load", () => {
    expect(unavailableOrderIds(found, [1, 2, 3, 99], 9)).toEqual([2, 3, 99]);
  });

  it("accepts the orders already linked to this same load", () => {
    expect(unavailableOrderIds(found, [1, 4], 9)).toEqual([]);
  });

  it("treats a loaded order as taken when creating a load", () => {
    expect(unavailableOrderIds(found, [4], undefined)).toEqual([4]);
  });
});
