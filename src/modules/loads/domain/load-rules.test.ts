import { describe, expect, it } from "vitest";
import {
  filterLoads,
  formatCop,
  groupLoadOrders,
  isLoadSupplier,
  loadFooter,
  summarizeLinkedOrders,
  totalsOfLoads,
  type LoadOrderBlock,
  type LoadOrderSource,
  type LoadRow,
} from "./load-rules";

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

const block = (id: number, bags: number): LoadOrderBlock => ({
  id,
  deliveryDate: "2026-11-20",
  timeWindow: null,
  status: "cargado",
  deliveredAt: null,
  clients: [{ clientName: "Cliente", locationName: null }],
  products: [],
  bags,
});

describe("summarizeLinkedOrders", () => {
  it("lists the order numbers and adds up the bags", () => {
    expect(summarizeLinkedOrders([block(3, 50), block(5, 25)])).toEqual({ label: "#3, #5", bags: 75 });
  });

  it("is empty without orders", () => {
    expect(summarizeLinkedOrders([])).toEqual({ label: "", bags: 0 });
  });
});

describe("loadFooter", () => {
  it("counts the orders and adds their bags", () => {
    expect(loadFooter([block(3, 50), block(5, 25)])).toEqual({ orders: 2, bags: 75 });
    expect(loadFooter([])).toEqual({ orders: 0, bags: 0 });
  });
});

describe("groupLoadOrders", () => {
  const orderLine = (over: Partial<LoadOrderSource["lines"][number]>) => ({
    clientName: "Agro Uno",
    locationName: null,
    referenceId: 1,
    referenceName: "Concentrado",
    referenceCode: "ABC",
    bags: 100,
    ...over,
  });
  const orders: LoadOrderSource[] = [
    {
      id: 12,
      deliveryDate: "2026-11-20",
      timeWindow: "7-11 a.m.",
      status: "entregado",
      deliveredAt: "2026-11-25",
      lines: [
        orderLine({}),
        orderLine({ referenceId: 2, referenceName: "Levante", referenceCode: "DEF", bags: 25, locationName: "La Esperanza" }),
        orderLine({ referenceId: 3, referenceName: "De otro proveedor", referenceCode: "ZZZ", bags: 10, clientName: "Otro" }),
      ],
    },
    { id: 9, deliveryDate: "2026-11-18", timeWindow: null, status: "cargado", deliveredAt: null, lines: [orderLine({ clientName: "Agro Dos", bags: 50 })] },
  ];
  const lines = [
    { orderId: 12, referenceId: 1, tons: 1.5 },
    { orderId: 12, referenceId: 1, tons: 2.5 },
    { orderId: 12, referenceId: 2, tons: 1 },
    { orderId: 9, referenceId: 1, tons: 2 },
  ];

  it("ignores the lines without an order (free loads)", () => {
    expect(groupLoadOrders([{ orderId: null, referenceId: null, tons: 3 }], orders)).toEqual([]);
  });

  it("gives one block per order of the load, by order number, with its day and window", () => {
    const blocks = groupLoadOrders(lines, orders);
    expect(blocks.map((b) => [b.id, b.deliveryDate, b.timeWindow])).toEqual([
      [9, "2026-11-18", null],
      [12, "2026-11-20", "7-11 a.m."],
    ]);
  });

  it("carries the status and the delivery day of each order", () => {
    const blocks = groupLoadOrders(lines, orders);
    expect(blocks.map((b) => [b.id, b.status, b.deliveredAt])).toEqual([
      [9, "cargado", null],
      [12, "entregado", "2026-11-25"],
    ]);
  });

  it("lists the products taken in this load with their bags and the tons of all their lines", () => {
    const [, second] = groupLoadOrders(lines, orders);
    expect(second?.products).toEqual([
      { referenceId: 1, label: "ABC · Concentrado", bags: 100, tons: 4 },
      { referenceId: 2, label: "DEF · Levante", bags: 25, tons: 1 },
    ]);
    expect(second?.bags).toBe(125);
  });

  it("shows only the clients and fincas of the products taken in this load", () => {
    const [, second] = groupLoadOrders(lines, orders);
    expect(second?.clients).toEqual([
      { clientName: "Agro Uno", locationName: null },
      { clientName: "Agro Uno", locationName: "La Esperanza" },
    ]);
  });

  it("skips an order that cannot be found and lines without a product", () => {
    expect(groupLoadOrders([{ orderId: 77, referenceId: 1, tons: 1 }, { orderId: 9, referenceId: null, tons: 1 }], orders)).toEqual([]);
  });
});
