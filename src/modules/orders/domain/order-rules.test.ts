import { describe, expect, it } from "vitest";
import {
  bagsToKg,
  canEditOrder,
  DEFAULT_KG_PER_BAG,
  DEFAULT_STATUS_FILTER,
  filterOrders,
  deriveOrderLoading,
  isValidKgPerBag,
  kgToTons,
  ordersTotals,
  orderTotals,
  productTotals,
  tonsDifference,
  orderLoadIds,
  orderStatusLabel,
  remainingLines,
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
  referenceCode: "114040",
  supplier: "Finca",
  bags: 50,
  ...over,
});

const order = (over: Partial<OrderRow> = {}): OrderRow => ({
  id: 1,
  deliveryDate: "2026-11-20",
  timeWindow: null,
  note: null,
  status: "pendiente",
  loads: [],
  partial: false,
  pendingSuppliers: ["Finca"],
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
  it("only a pending order without loads can be edited or annulled", () => {
    expect(canEditOrder("pendiente")).toBe(true);
    expect(canEditOrder("pendiente", false)).toBe(true);
    expect(canEditOrder("pendiente", true)).toBe(false);
    expect(canEditOrder("cargado")).toBe(false);
    expect(canEditOrder("anulado")).toBe(false);
  });
});

describe("deriveOrderLoading", () => {
  it("is pending while no supplier of its products has a load", () => {
    expect(deriveOrderLoading("pendiente", ["Finca", "Italcol"], [])).toEqual({
      status: "pendiente",
      partial: false,
      pendingSuppliers: ["Finca", "Italcol"],
    });
  });

  it("is partially loaded when only some suppliers have a load", () => {
    expect(deriveOrderLoading("pendiente", ["Finca", "Italcol", "Finca"], ["Italcol"])).toEqual({
      status: "pendiente",
      partial: true,
      pendingSuppliers: ["Finca"],
    });
  });

  it("is loaded when every supplier of its products has a load", () => {
    expect(deriveOrderLoading("pendiente", ["Finca", "Italcol"], ["Italcol", "Finca"])).toEqual({
      status: "cargado",
      partial: false,
      pendingSuppliers: [],
    });
  });

  it("is loaded with a single supplier once that supplier has a load", () => {
    expect(deriveOrderLoading("pendiente", ["Finca", "Finca"], ["Finca"]).status).toBe("cargado");
  });

  it("keeps an annulled order annulled", () => {
    expect(deriveOrderLoading("anulado", ["Finca"], [])).toEqual({ status: "anulado", partial: false, pendingSuppliers: [] });
  });

  it("ignores products without a supplier and never loads an order made only of them", () => {
    expect(deriveOrderLoading("pendiente", [null], [])).toEqual({ status: "pendiente", partial: false, pendingSuppliers: [] });
    expect(deriveOrderLoading("pendiente", ["Finca", null], ["Finca"]).status).toBe("cargado");
  });

  it("treats a legacy persisted loaded status as pending: loads decide it", () => {
    expect(deriveOrderLoading("cargado", ["Finca"], []).status).toBe("pendiente");
  });
});

describe("orderStatusLabel", () => {
  it("says partially loaded for a partial order", () => {
    expect(orderStatusLabel({ status: "pendiente", partial: true })).toBe("Cargado parcial");
    expect(orderStatusLabel({ status: "pendiente", partial: false })).toBe("Pendiente");
    expect(orderStatusLabel({ status: "cargado", partial: false })).toBe("Cargado");
  });
});

describe("orderLoadIds", () => {
  it("lists the loads of the order once each, ascending", () => {
    const loads = [
      { loadId: 9, supplier: "Italcol" as const },
      { loadId: 4, supplier: "Finca" as const },
      { loadId: 9, supplier: "Finca" as const },
    ];
    expect(orderLoadIds(order({ loads }))).toEqual([4, 9]);
    expect(orderLoadIds(order())).toEqual([]);
  });
});

describe("remainingLines", () => {
  const lines = [
    line({ id: 1, supplier: "Finca" }),
    line({ id: 2, referenceId: 2, supplier: "Italcol" }),
    line({ id: 3, referenceId: 3, supplier: null }),
  ];

  it("is every line while nothing has been loaded", () => {
    expect(remainingLines(order({ lines })).map((l) => l.id)).toEqual([1, 2, 3]);
  });

  it("keeps only the products of the suppliers still pending once partially loaded", () => {
    expect(remainingLines(order({ lines, partial: true, pendingSuppliers: ["Italcol"] })).map((l) => l.id)).toEqual([2]);
  });
});

describe("filterOrders", () => {
  const rows = [
    order({ id: 1, status: "pendiente", deliveryDate: "2026-11-10" }),
    order({ id: 2, status: "cargado", deliveryDate: "2026-11-15" }),
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

describe("productTotals", () => {
  const line = (referenceId: number, referenceName: string, bags: number) => ({
    referenceId,
    referenceName,
    referenceCode: null,
    bags,
  });

  it("sums the bags of each product across the lines, most bags first", () => {
    expect(productTotals([line(1, "Maxi-Leche 585", 10), line(2, "Ceba 100", 30), line(1, "Maxi-Leche 585", 25)])).toEqual([
      { referenceId: 1, referenceName: "Maxi-Leche 585", referenceCode: null, bags: 35 },
      { referenceId: 2, referenceName: "Ceba 100", referenceCode: null, bags: 30 },
    ]);
  });

  it("breaks ties by name and keeps apart products that share a name", () => {
    expect(productTotals([line(1, "Zeta", 2), line(2, "Alfa", 2)]).map((p) => p.referenceName)).toEqual(["Alfa", "Zeta"]);
    expect(productTotals([line(1, "Terneras Nodriza", 3), line(2, "Terneras Nodriza", 4)]).map((p) => [p.referenceId, p.bags])).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });

  it("is empty without lines", () => {
    expect(productTotals([])).toEqual([]);
  });
});
