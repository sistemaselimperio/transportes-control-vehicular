import { describe, expect, it } from "vitest";
import { filterLoads, formatCop, isLoadSupplier, summarizeLinkedOrders, totalsOfLoads, type LoadRow } from "./load-rules";

const load = (over: Partial<LoadRow>): LoadRow => ({
  id: 1,
  date: "2026-11-10",
  supplier: "Finca",
  plate: "ABC-123",
  vehicleId: 1,
  tons: 30,
  cost: 1_500_000,
  lines: [],
  notes: null,
  orders: [],
  ...over,
});

describe("isLoadSupplier", () => {
  it("knows the three suppliers", () => {
    expect(isLoadSupplier("Italcol")).toBe(true);
    expect(isLoadSupplier("Otro")).toBe(false);
  });
});

describe("filterLoads", () => {
  const rows = [
    load({ id: 1, date: "2026-11-01", supplier: "Finca" }),
    load({ id: 2, date: "2026-11-10", supplier: "Italcol" }),
    load({ id: 3, date: "2026-11-20", supplier: "Italcol" }),
  ];
  const none = { supplier: null, from: null, to: null };

  it("keeps everything without filters", () => {
    expect(filterLoads(rows, none)).toHaveLength(3);
  });

  it("filters by supplier", () => {
    expect(filterLoads(rows, { ...none, supplier: "Italcol" }).map((r) => r.id)).toEqual([2, 3]);
  });

  it("filters by an inclusive date range", () => {
    expect(filterLoads(rows, { ...none, from: "2026-11-10", to: "2026-11-20" }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterLoads(rows, { ...none, to: "2026-11-09" }).map((r) => r.id)).toEqual([1]);
  });
});

describe("totalsOfLoads", () => {
  it("adds tons and cost", () => {
    expect(totalsOfLoads([load({ tons: 30.5, cost: 1_000_000 }), load({ id: 2, tons: 10, cost: 500_000 })])).toEqual({
      count: 2,
      tons: 40.5,
      cost: 1_500_000,
    });
  });
});

describe("formatCop", () => {
  it("formats whole pesos in es-CO", () => {
    expect(formatCop(1_500_000).replace(/\s/g, " ")).toBe("$ 1.500.000");
    expect(formatCop(0).replace(/\s/g, " ")).toBe("$ 0");
  });
});

describe("summarizeLinkedOrders", () => {
  const linked = (id: number, bags: number) => ({ id, bags, lines: [{ clientName: "Cliente", locationName: null }] });

  it("lists the order numbers and adds up the bags", () => {
    expect(summarizeLinkedOrders([linked(3, 50), linked(5, 25)])).toEqual({ label: "#3, #5", bags: 75 });
  });

  it("is empty without orders", () => {
    expect(summarizeLinkedOrders([])).toEqual({ label: "", bags: 0 });
  });
});
