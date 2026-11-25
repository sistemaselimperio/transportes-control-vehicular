import { describe, expect, it } from "vitest";
import type { LoadSupplier } from "./load-rules";
import {
  allocationInputsOf,
  buildDrafts,
  buildPendingOrders,
  draftsTotals,
  isBlockDraftComplete,
  orderParts,
  pendingSuppliersOf,
  serializeBlocks,
  type PendingSource,
} from "./load-pending";
import type { LoadLineRow } from "./load-lines";

let lineId = 0;
const orderLine = (clientId: number, referenceId: number, supplier: LoadSupplier, bags: number) => ({
  id: ++lineId,
  clientId,
  clientName: `Cliente ${clientId}`,
  locationId: null,
  locationName: null,
  referenceId,
  referenceName: `Producto ${referenceId}`,
  referenceCode: `C${referenceId}`,
  supplier,
  bags,
});

const order = (id: number, deliveryDate: string, lines: ReturnType<typeof orderLine>[], over: Partial<PendingSource> = {}): PendingSource => ({
  id,
  status: "pendiente",
  deliveryDate,
  timeWindow: null,
  pendingSuppliers: [...new Set(lines.map((l) => l.supplier))],
  lines,
  ...over,
});

// Finca products 1-2, Contegral product 5.
const orders = [
  order(3, "2026-11-20", [orderLine(1, 1, "Finca", 100), orderLine(2, 5, "Contegral", 50)]),
  order(1, "2026-11-18", [orderLine(1, 1, "Finca", 75), orderLine(3, 2, "Finca", 25)]),
  order(2, "2026-11-18", [orderLine(2, 5, "Contegral", 25)]),
];

describe("pendingSuppliersOf", () => {
  it("lists the suppliers still to load in the fixed supplier order", () => {
    const mixed = order(1, "2026-11-18", [orderLine(1, 5, "Contegral", 1), orderLine(1, 1, "Finca", 1)], {
      pendingSuppliers: ["Contegral", "Finca"],
    });
    expect(pendingSuppliersOf(mixed)).toEqual(["Finca", "Contegral"]);
  });

  it("is empty for an order that is annulled or fully loaded", () => {
    const lines = [orderLine(1, 1, "Finca", 1)];
    expect(pendingSuppliersOf(order(1, "2026-11-18", lines, { status: "anulado", pendingSuppliers: [] }))).toEqual([]);
    expect(pendingSuppliersOf(order(1, "2026-11-18", lines, { status: "cargado", pendingSuppliers: [] }))).toEqual([]);
  });
});

describe("orderParts", () => {
  it("splits the order by supplier in the fixed order, flagging the loaded ones and listing most bags first", () => {
    const partial = order(7, "2026-11-18", [orderLine(1, 1, "Finca", 10), orderLine(1, 2, "Finca", 30), orderLine(1, 5, "Contegral", 10)], {
      pendingSuppliers: ["Contegral"],
    });
    expect(orderParts(partial, 40)).toEqual([
      {
        supplier: "Finca",
        pending: false,
        bags: 40,
        tons: 1.6,
        products: [
          { referenceId: 2, label: "C2 · Producto 2", bags: 30, tons: 1.2 },
          { referenceId: 1, label: "C1 · Producto 1", bags: 10, tons: 0.4 },
        ],
      },
      { supplier: "Contegral", pending: true, bags: 10, tons: 0.4, products: [{ referenceId: 5, label: "C5 · Producto 5", bags: 10, tons: 0.4 }] },
    ]);
  });
});

describe("buildPendingOrders", () => {
  const rows = buildPendingOrders(orders, 40);

  it("lists each order with pending work once, oldest delivery first", () => {
    expect(rows.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(buildPendingOrders([], 40)).toEqual([]);
  });

  it("names the pending suppliers in the fixed supplier order", () => {
    expect(rows.map((o) => [o.id, o.suppliers])).toEqual([
      [1, ["Finca"]],
      [2, ["Contegral"]],
      [3, ["Finca", "Contegral"]],
    ]);
  });

  it("totals the bags, tons and clients of the pending parts", () => {
    expect(rows.map((o) => [o.id, o.bags, o.tons, o.clients])).toEqual([
      [1, 100, 4, ["Cliente 1", "Cliente 3"]],
      [2, 25, 1, ["Cliente 2"]],
      [3, 150, 6, ["Cliente 1", "Cliente 2"]],
    ]);
  });

  it("leaves out the part already loaded but keeps it in the detail", () => {
    const partial = [order(7, "2026-11-18", [orderLine(1, 1, "Finca", 10), orderLine(2, 5, "Contegral", 10)], { pendingSuppliers: ["Contegral"] })];
    const [only] = buildPendingOrders(partial, 40);
    expect(only).toMatchObject({ suppliers: ["Contegral"], bags: 10, clients: ["Cliente 2"] });
    expect(only?.parts.map((p) => [p.supplier, p.pending])).toEqual([
      ["Finca", false],
      ["Contegral", true],
    ]);
  });

  it("skips orders that are annulled or fully loaded", () => {
    const done = order(9, "2026-11-18", [orderLine(1, 1, "Finca", 10)], { status: "cargado", pendingSuppliers: [] });
    expect(buildPendingOrders([done], 40)).toEqual([]);
  });
});

describe("buildDrafts", () => {
  const single = orders[1] as PendingSource; // order 1: Finca only
  const mixed = orders[0] as PendingSource; // order 3: Finca + Contegral

  it("makes a block per target with each supplier product suggested from its bags", () => {
    const drafts = buildDrafts(
      [
        { order: mixed, supplier: "Finca" },
        { order: mixed, supplier: "Contegral" },
      ],
      40,
    );
    expect(drafts.blocks).toEqual([
      { orderId: 3, supplier: "Finca", siesaNumber: "", orderNumber: "", cost: "" },
      { orderId: 3, supplier: "Contegral", siesaNumber: "", orderNumber: "", cost: "" },
    ]);
    expect(drafts.products.map((p) => [p.orderId, p.supplier, p.referenceId, p.reference, p.tons])).toEqual([
      [3, "Finca", 1, "C1 · Producto 1", "4"],
      [3, "Contegral", 5, "C5 · Producto 5", "2"],
    ]);
    expect(new Set(drafts.products.map((p) => p.key)).size).toBe(2);
  });

  const stored = (over: Partial<LoadLineRow>): LoadLineRow => ({
    id: 1,
    orderId: 1,
    referenceId: 1,
    referenceName: "Producto 1",
    referenceCode: "C1",
    tons: 3,
    cost: 600,
    siesaNumber: "S-1",
    orderNumber: "P-1",
    ...over,
  });

  it("fills an edit with the SIESA, supplier order and the cost summed over the order's lines, and the ordered tons", () => {
    const drafts = buildDrafts([{ order: single, supplier: "Finca" }], 40, [
      stored({ id: 1, referenceId: 1, tons: 3.5, cost: 600 }),
      stored({ id: 2, referenceId: 2, tons: 1, cost: 400 }),
    ]);
    expect(drafts.blocks[0]).toEqual({ orderId: 1, supplier: "Finca", siesaNumber: "S-1", orderNumber: "P-1", cost: "1000" });
    expect(drafts.products.map((p) => p.tons)).toEqual(["3", "1"]);
  });

  it("takes the first SIESA when the old lines of an order differ", () => {
    const drafts = buildDrafts([{ order: single, supplier: "Finca" }], 40, [
      stored({ id: 1, referenceId: 1, tons: 1, siesaNumber: "S-1" }),
      stored({ id: 2, referenceId: 1, tons: 2, siesaNumber: "S-2" }),
      stored({ id: 3, referenceId: 2, tons: 1, siesaNumber: "S-3" }),
    ]);
    expect(drafts.blocks[0]?.siesaNumber).toBe("S-1");
  });

  it("always takes the ordered tons, whatever the stored lines carried", () => {
    const drafts = buildDrafts([{ order: single, supplier: "Finca" }], 40, [
      stored({ id: 1, referenceId: 1, tons: 3.5 }),
      stored({ id: 2, referenceId: null, referenceName: null, referenceCode: null, tons: 9 }),
    ]);
    expect(drafts.products.map((p) => p.tons)).toEqual(["3", "1"]);
  });
});

describe("isBlockDraftComplete", () => {
  const block = { orderId: 1, supplier: "Finca" as const, siesaNumber: "123", orderNumber: "P-9", cost: "1.500.000" };
  const products = [
    { orderId: 1, supplier: "Finca" as const, tons: "7,2" },
    { orderId: 1, supplier: "Contegral" as const, tons: "" },
    { orderId: 2, supplier: "Finca" as const, tons: "" },
  ];

  it("accepts a block with every field filled, ignoring the products of other blocks", () => {
    expect(isBlockDraftComplete(block, products)).toBe(true);
  });

  it.each([
    ["siesa", { siesaNumber: " " }],
    ["supplier order", { orderNumber: "" }],
    ["cost blank", { cost: "" }],
    ["cost zero", { cost: "0" }],
  ])("rejects a block with %s missing", (_name, over) => {
    expect(isBlockDraftComplete({ ...block, ...over }, products)).toBe(false);
  });

  it("rejects a product without tons, and a block without products", () => {
    expect(isBlockDraftComplete(block, [{ orderId: 1, supplier: "Finca", tons: "0" }])).toBe(false);
    expect(isBlockDraftComplete(block, [{ orderId: 1, supplier: "Finca", tons: "abc" }])).toBe(false);
    expect(isBlockDraftComplete(block, [])).toBe(false);
  });
});

describe("draftsTotals and serializeBlocks", () => {
  const drafts = {
    blocks: [
      { orderId: 1, supplier: "Finca" as const, siesaNumber: "S-1", orderNumber: "P-1", cost: "1.500.000" },
      { orderId: 1, supplier: "Contegral" as const, siesaNumber: "S-3", orderNumber: "P-3", cost: "2.000" },
    ],
    products: [
      { key: 0, orderId: 1, supplier: "Finca" as const, referenceId: 1, reference: "C1", tons: "7,2" },
      { key: 1, orderId: 1, supplier: "Contegral" as const, referenceId: 5, reference: "C5", tons: "0,1" },
      { key: 2, orderId: 1, supplier: "Contegral" as const, referenceId: 6, reference: "C6", tons: "x" },
    ],
  };

  it("counts the blocks and adds what was typed, ignoring what cannot be read", () => {
    expect(draftsTotals(drafts)).toEqual({ blocks: 2, tons: 7.3, cost: 1_502_000 });
  });

  it("sends each block with its order, supplier, numbers and products as typed", () => {
    expect(JSON.parse(serializeBlocks(drafts))).toEqual([
      { orderId: 1, supplier: "Finca", siesaNumber: "S-1", orderNumber: "P-1", cost: "1.500.000", lines: [{ referenceId: 1, tons: "7,2" }] },
      {
        orderId: 1,
        supplier: "Contegral",
        siesaNumber: "S-3",
        orderNumber: "P-3",
        cost: "2.000",
        lines: [
          { referenceId: 5, tons: "0,1" },
          { referenceId: 6, tons: "x" },
        ],
      },
    ]);
  });
});

describe("allocationInputsOf", () => {
  const mixed = orders[0] as PendingSource;

  it("makes one allocation per supplier with the orders and typed tons of its blocks", () => {
    const inputs = allocationInputsOf(
      [
        { orderId: 3, supplier: "Finca" },
        { orderId: 3, supplier: "Contegral" },
      ],
      [mixed],
      [
        { orderId: 3, supplier: "Finca", referenceId: 1, tons: "4" },
        { orderId: 3, supplier: "Contegral", referenceId: 5, tons: "1,5" },
      ],
      40,
    );
    expect(inputs.map((i) => [i.supplier, i.kgPerBag, i.orders.map((o) => o.id), i.lines])).toEqual([
      ["Finca", 40, [3], [{ orderId: 3, referenceId: 1, tons: 4 }]],
      ["Contegral", 40, [3], [{ orderId: 3, referenceId: 5, tons: 1.5 }]],
    ]);
    expect(inputs[0]?.orders[0]?.lines[0]).toMatchObject({ referenceId: 1, label: "C1 · Producto 1", supplier: "Finca", bags: 100 });
  });
});
