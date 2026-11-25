import { describe, expect, it } from "vitest";
import { createLoadsSchema, loadIdSchema, loadSchema } from "./load-schemas";

const product = { referenceId: 10, tons: "32,5" };
const order = { orderId: 12, siesaNumber: " FV-100 ", orderNumber: " P-77 ", cost: "$ 1.500.000", lines: [product] };

const valid = {
  date: "2026-11-18",
  supplier: "Italcol",
  plate: "abc 123",
  notes: "",
  orders: JSON.stringify([order]),
};

const withOrders = (orders: unknown[]) => ({ ...valid, orders: JSON.stringify(orders) });
const firstIssue = (input: unknown) => {
  const r = loadSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("loadSchema", () => {
  it("parses a valid form", () => {
    expect(loadSchema.parse(valid)).toEqual({
      date: "2026-11-18",
      supplier: "Italcol",
      plate: "ABC-123",
      notes: null,
      orders: [{ orderId: 12, siesaNumber: "FV-100", orderNumber: "P-77", cost: 1_500_000, lines: [{ referenceId: 10, tons: 32.5 }] }],
    });
  });

  it("requires a known supplier", () => {
    expect(firstIssue({ ...valid, supplier: "Otro" })).toBe("Elige el proveedor.");
  });

  it("requires the plate", () => {
    expect(firstIssue({ ...valid, plate: "" })).toBe("Elige la placa del vehículo.");
  });

  it("requires at least one order and readable JSON", () => {
    expect(firstIssue({ ...valid, orders: "[]" })).toBe("Elige al menos un pedido.");
    expect(firstIssue({ ...valid, orders: "no json" })).toBe("Los pedidos del cargue no son válidos.");
  });

  it("requires a valid order id on each block", () => {
    for (const orderId of [null, undefined, 0, 1.5, "12"]) {
      expect(firstIssue(withOrders([{ ...order, orderId }]))).toBe("Cada bloque debe pertenecer a un pedido.");
    }
  });

  it("requires at least one product per order and a product id on each", () => {
    expect(firstIssue(withOrders([{ ...order, lines: [] }]))).toBe("Cada pedido necesita al menos un producto.");
    for (const referenceId of [null, undefined, 0, 1.5, "10"]) {
      expect(firstIssue(withOrders([{ ...order, lines: [{ ...product, referenceId }] }]))).toBe("Elige el producto de cada línea.");
    }
  });

  it("requires tons above zero", () => {
    for (const tons of ["", "0", "abc"]) {
      expect(firstIssue(withOrders([{ ...order, lines: [{ ...product, tons }] }]))).toBe(
        "Las toneladas de cada producto deben ser un número mayor que cero.",
      );
    }
  });

  it("accepts a zero cost but not a blank or negative one", () => {
    expect(loadSchema.parse(withOrders([{ ...order, cost: "0" }])).orders[0]?.cost).toBe(0);
    expect(firstIssue(withOrders([{ ...order, cost: "" }]))).toBe("Ingresa el costo total en pesos de cada pedido.");
    expect(loadSchema.safeParse(withOrders([{ ...order, cost: "-5" }])).success).toBe(false);
    expect(loadSchema.safeParse(withOrders([{ ...order, cost: "abc" }])).success).toBe(false);
  });

  it("requires the SIESA and the supplier order number of each order", () => {
    expect(firstIssue(withOrders([{ ...order, siesaNumber: "  " }]))).toBe("Ingresa el número SIESA de cada pedido.");
    expect(firstIssue(withOrders([{ ...order, orderNumber: "" }]))).toBe("Ingresa el número de pedido proveedor de cada pedido.");
  });

  it("names a SIESA number used by two orders of the load", () => {
    expect(firstIssue(withOrders([order, { ...order, orderId: 13 }]))).toBe("El número SIESA FV-100 está repetido en el cargue.");
  });

  it("allows the same supplier order number on two orders, and names an order sent twice", () => {
    expect(loadSchema.safeParse(withOrders([order, { ...order, orderId: 13, siesaNumber: "FV-101" }])).success).toBe(true);
    expect(firstIssue(withOrders([order, { ...order, siesaNumber: "FV-101" }]))).toBe("El pedido #12 está repetido en el cargue.");
  });
});

describe("createLoadsSchema", () => {
  const blockBase = { siesaNumber: order.siesaNumber, orderNumber: order.orderNumber, cost: order.cost, lines: order.lines };
  const finca = { ...blockBase, supplier: "Finca" };
  const contegral = { ...blockBase, supplier: "Contegral", siesaNumber: "FV-101", lines: [{ referenceId: 20, tons: "5" }] };
  const base = { date: "2026-11-18", orderId: "12", plate: "abc 123", notes: "", blocks: JSON.stringify([finca, contegral]) };
  const firstBlocksIssue = (input: unknown) => {
    const r = createLoadsSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("parses the order, the shared fields and one block per supplier", () => {
    expect(createLoadsSchema.parse(base)).toEqual({
      date: "2026-11-18",
      orderId: 12,
      plate: "ABC-123",
      notes: null,
      blocks: [
        { supplier: "Finca", siesaNumber: "FV-100", orderNumber: "P-77", cost: 1_500_000, lines: [{ referenceId: 10, tons: 32.5 }] },
        { supplier: "Contegral", siesaNumber: "FV-101", orderNumber: "P-77", cost: 1_500_000, lines: [{ referenceId: 20, tons: 5 }] },
      ],
    });
  });

  it("requires a valid order id and a plate", () => {
    for (const orderId of ["", "0", "abc", "1.5"]) expect(firstBlocksIssue({ ...base, orderId })).toBe("Elige el pedido.");
    expect(firstBlocksIssue({ ...base, plate: "" })).toBe("Elige la placa del vehículo.");
  });

  it("requires at least one block, readable JSON and a known supplier", () => {
    expect(firstBlocksIssue({ ...base, blocks: "[]" })).toBe("Elige al menos un proveedor.");
    expect(firstBlocksIssue({ ...base, blocks: "no json" })).toBe("Los proveedores del cargue no son válidos.");
    expect(firstBlocksIssue({ ...base, blocks: JSON.stringify([{ ...finca, supplier: "Otro" }]) })).toBe("Elige el proveedor.");
  });

  it("names a supplier or a SIESA number used by two blocks", () => {
    expect(firstBlocksIssue({ ...base, blocks: JSON.stringify([finca, { ...contegral, supplier: "Finca" }]) })).toBe(
      "El proveedor Finca está repetido en el cargue.",
    );
    expect(firstBlocksIssue({ ...base, blocks: JSON.stringify([finca, { ...contegral, siesaNumber: "FV-100" }]) })).toBe(
      "El número SIESA FV-100 está repetido en el cargue.",
    );
  });

  it("applies the order rules to each block", () => {
    expect(firstBlocksIssue({ ...base, blocks: JSON.stringify([{ ...finca, cost: "" }]) })).toBe("Ingresa el costo total en pesos de cada pedido.");
    expect(firstBlocksIssue({ ...base, blocks: JSON.stringify([{ ...finca, lines: [] }]) })).toBe("Cada pedido necesita al menos un producto.");
  });
});

describe("loadIdSchema", () => {
  it("accepts positive integers only", () => {
    expect(loadIdSchema.safeParse(2).success).toBe(true);
    expect(loadIdSchema.safeParse(0).success).toBe(false);
  });
});
