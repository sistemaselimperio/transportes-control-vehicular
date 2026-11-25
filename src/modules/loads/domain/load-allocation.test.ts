import { describe, expect, it } from "vitest";
import {
  allocationErrors,
  compareAllocation,
  isOrderLoadable,
  loadableSuppliers,
  unavailableOrderIds,
  type AllocationInput,
  type LoadableOrder,
} from "./load-allocation";

const FINCA_PRODUCT = { referenceId: 1, label: "ABC · Concentrado", supplier: "Finca" as const };
const FINCA_OTHER = { referenceId: 2, label: "DEF · Levante", supplier: "Finca" as const };
const ITALCOL_PRODUCT = { referenceId: 3, label: "XYZ · Italcol", supplier: "Italcol" as const };

const input = (over: Partial<AllocationInput> = {}): AllocationInput => ({
  supplier: "Finca",
  kgPerBag: 40,
  orders: [{ id: 12, lines: [{ ...FINCA_PRODUCT, bags: 100 }, { ...FINCA_OTHER, bags: 25 }, { ...ITALCOL_PRODUCT, bags: 10 }] }],
  lines: [
    { orderId: 12, referenceId: 1, tons: 4 },
    { orderId: 12, referenceId: 2, tons: 1 },
  ],
  ...over,
});

describe("compareAllocation", () => {
  it("compares per order and product the kg expected (bags x kg per bag) with the kg entered", () => {
    expect(compareAllocation(input({ lines: [{ orderId: 12, referenceId: 1, tons: 3.95 }, { orderId: 12, referenceId: 2, tons: 1.001 }] }))).toEqual([
      {
        orderId: 12,
        products: [
          { referenceId: 1, label: "ABC · Concentrado", bags: 100, expectedKg: 4000, enteredKg: 3950, differenceKg: -50 },
          { referenceId: 2, label: "DEF · Levante", bags: 25, expectedKg: 1000, enteredKg: 1001, differenceKg: 1 },
        ],
        strayReferenceIds: [],
        lineCount: 2,
      },
    ]);
  });

  it("adds the lines of a product split in several lines, to the kilogram without float noise", () => {
    const [order] = compareAllocation(
      input({ lines: [{ orderId: 12, referenceId: 1, tons: 1.1 }, { orderId: 12, referenceId: 1, tons: 2.9 }] }),
    );
    expect(order?.products[0]).toMatchObject({ enteredKg: 4000, differenceKg: 0 });
    expect(order?.products[1]).toMatchObject({ enteredKg: 0, differenceKg: -1000 });
  });

  it("only expects the products of the load supplier and sums the bags of repeated product lines", () => {
    const [order] = compareAllocation(
      input({ orders: [{ id: 12, lines: [{ ...FINCA_PRODUCT, bags: 60 }, { ...FINCA_PRODUCT, bags: 40 }, { ...ITALCOL_PRODUCT, bags: 5 }] }], lines: [] }),
    );
    expect(order?.products.map((p) => [p.referenceId, p.bags])).toEqual([[1, 100]]);
  });

  it("flags lines of products that are not in the order for the supplier", () => {
    const [order] = compareAllocation(
      input({ lines: [{ orderId: 12, referenceId: 1, tons: 4 }, { orderId: 12, referenceId: 3, tons: 1 }, { orderId: 12, referenceId: 99, tons: 1 }] }),
    );
    expect(order?.strayReferenceIds).toEqual([3, 99]);
  });

  it("uses the current kg per bag, rounded to the kilo", () => {
    const [order] = compareAllocation(input({ kgPerBag: 40.5, orders: [{ id: 12, lines: [{ ...FINCA_PRODUCT, bags: 3 }] }], lines: [] }));
    expect(order?.products[0]?.expectedKg).toBe(122);
  });
});

describe("allocationErrors", () => {
  it("accepts a load that covers every product of the order to the kilo", () => {
    expect(allocationErrors(input())).toEqual([]);
  });

  it("accepts a product split in several lines that adds up exactly", () => {
    const lines = [
      { orderId: 12, referenceId: 1, tons: 2.5 },
      { orderId: 12, referenceId: 1, tons: 1.5 },
      { orderId: 12, referenceId: 2, tons: 1 },
    ];
    expect(allocationErrors(input({ lines }))).toEqual([]);
  });

  it("names the order, the product and the missing kilos", () => {
    const lines = [{ orderId: 12, referenceId: 1, tons: 3.95 }, { orderId: 12, referenceId: 2, tons: 1 }];
    expect(allocationErrors(input({ lines }))).toEqual(["Pedido #12 · ABC · Concentrado: faltan 50 kg"]);
  });

  it("names the surplus kilos", () => {
    const lines = [{ orderId: 12, referenceId: 1, tons: 4 }, { orderId: 12, referenceId: 2, tons: 1.001 }];
    expect(allocationErrors(input({ lines }))).toEqual(["Pedido #12 · DEF · Levante: sobra 1 kg"]);
    expect(allocationErrors(input({ lines: [{ orderId: 12, referenceId: 1, tons: 4.25 }, { orderId: 12, referenceId: 2, tons: 1 }] }))).toEqual([
      "Pedido #12 · ABC · Concentrado: sobran 250 kg",
    ]);
  });

  it("requires every product of the supplier: a product without lines is all missing", () => {
    expect(allocationErrors(input({ lines: [{ orderId: 12, referenceId: 1, tons: 4 }] }))).toEqual(["Pedido #12 · DEF · Levante: faltan 1.000 kg"]);
  });

  it("refuses a checked order with no lines", () => {
    expect(allocationErrors(input({ lines: [] }))).toEqual(["Pedido #12: agrega los productos de Finca que se cargan."]);
  });

  it("refuses an order with no products of the supplier", () => {
    const orders = [{ id: 12, lines: [{ ...ITALCOL_PRODUCT, bags: 10 }] }];
    expect(allocationErrors(input({ orders, lines: [] }))).toEqual(["Pedido #12: no tiene productos de Finca por cargar."]);
  });

  it("refuses lines of a product that is not in the order or belongs to another supplier", () => {
    const lines = [
      { orderId: 12, referenceId: 1, tons: 4 },
      { orderId: 12, referenceId: 2, tons: 1 },
      { orderId: 12, referenceId: 3, tons: 0.4 },
      { orderId: 12, referenceId: 99, tons: 0.4 },
    ];
    expect(allocationErrors(input({ lines }))).toEqual([
      "Pedido #12 · XYZ · Italcol: este producto no es del pedido para Finca",
      "Pedido #12 · producto 99: este producto no es del pedido para Finca",
    ]);
  });

  it("refuses lines of an order that is not checked", () => {
    const lines = [...input().lines, { orderId: 7, referenceId: 1, tons: 1 }];
    expect(allocationErrors(input({ lines }))).toEqual(["Pedido #7: tiene productos pero no está entre los pedidos elegidos"]);
  });

  it("checks each order on its own", () => {
    const orders = [
      { id: 12, lines: [{ ...FINCA_PRODUCT, bags: 100 }] },
      { id: 13, lines: [{ ...FINCA_PRODUCT, bags: 50 }] },
    ];
    const lines = [
      { orderId: 12, referenceId: 1, tons: 4 },
      { orderId: 13, referenceId: 1, tons: 1.9 },
    ];
    expect(allocationErrors(input({ orders, lines }))).toEqual(["Pedido #13 · ABC · Concentrado: faltan 100 kg"]);
  });

  it("is the empty list when nothing is checked and nothing is entered", () => {
    expect(allocationErrors(input({ orders: [], lines: [] }))).toEqual([]);
  });
});

describe("order availability", () => {
  const order = (over: Partial<LoadableOrder> = {}): LoadableOrder => ({
    id: 1,
    status: "pendiente",
    loads: [],
    lines: [{ supplier: "Finca" }, { supplier: "Italcol" }],
    ...over,
  });

  it("is loadable by a supplier that has products in it and no load yet", () => {
    expect(isOrderLoadable(order(), "Finca")).toBe(true);
    expect(isOrderLoadable(order(), "Contegral")).toBe(false);
  });

  it("is not loadable once annulled or once that supplier has a load, but the other supplier still is", () => {
    expect(isOrderLoadable(order({ status: "anulado" }), "Finca")).toBe(false);
    const partial = order({ loads: [{ loadId: 8, supplier: "Finca" }] });
    expect(isOrderLoadable(partial, "Finca")).toBe(false);
    expect(isOrderLoadable(partial, "Italcol")).toBe(true);
  });

  it("counts the load being edited as available", () => {
    const loaded = order({ status: "cargado", loads: [{ loadId: 8, supplier: "Finca" }, { loadId: 9, supplier: "Italcol" }] });
    expect(isOrderLoadable(loaded, "Finca", 8)).toBe(true);
    expect(isOrderLoadable(loaded, "Finca", 9)).toBe(false);
  });

  it("lists the requested orders that are missing or not loadable", () => {
    const found = [order({ id: 1 }), order({ id: 2, status: "anulado" }), order({ id: 3, loads: [{ loadId: 8, supplier: "Finca" }] })];
    expect(unavailableOrderIds(found, [1, 2, 3, 99], "Finca")).toEqual([2, 3, 99]);
    expect(unavailableOrderIds(found, [3], "Finca", 8)).toEqual([]);
  });

  it("lists the suppliers a new load can still take of an order, in the fixed order", () => {
    const rows = order({ lines: [{ supplier: "Italcol" }, { supplier: "Finca" }] });
    expect(loadableSuppliers(rows)).toEqual(["Finca", "Italcol"]);
    expect(loadableSuppliers({ ...rows, loads: [{ loadId: 8, supplier: "Finca" }] })).toEqual(["Italcol"]);
    expect(loadableSuppliers({ ...rows, status: "anulado" })).toEqual([]);
  });
});
