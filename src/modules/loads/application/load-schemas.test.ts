import { describe, expect, it } from "vitest";
import { balanceTripSchema, createLoadsSchema, freeLoadSchema, loadIdSchema, loadSchema } from "./load-schemas";

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

describe("the balance of an order", () => {
  const withBalance = (balance: unknown) => withOrders([{ ...order, balance }]);

  it("parses the leftover bags, the date and an optional plate", () => {
    const parsed = loadSchema.parse(withBalance({ bags: " 5 ", date: "2026-11-25", plate: "abc 123" }));
    expect(parsed.orders[0]?.balance).toEqual({ bags: 5, date: "2026-11-25", plate: "ABC-123" });
  });

  it("takes a blank plate as none", () => {
    expect(loadSchema.parse(withBalance({ bags: "5", date: "2026-11-25", plate: "" })).orders[0]?.balance?.plate).toBeNull();
    expect(loadSchema.parse(withBalance({ bags: "5", date: "2026-11-25" })).orders[0]?.balance?.plate).toBeNull();
  });

  it("is optional: absent or null means a complete load", () => {
    expect(loadSchema.parse(valid).orders[0]?.balance).toBeUndefined();
    expect(loadSchema.parse(withBalance(null)).orders[0]?.balance).toBeNull();
  });

  it.each(["", "0", "-1", "2,5", "abc"])("requires whole bags above zero (%j)", (bags) => {
    expect(firstIssue(withBalance({ bags, date: "2026-11-25" }))).toBe("Los bultos que se quedan deben ser un número entero mayor que cero.");
  });

  it("requires a valid date", () => {
    expect(firstIssue(withBalance({ bags: "5", date: "" }))).toBe("La fecha del saldo: ingresa una fecha válida.");
    expect(firstIssue(withBalance({ bags: "5", date: "25/11/2026" }))).toBe("La fecha del saldo: ingresa una fecha válida.");
  });

  it("also travels on the blocks of a new load", () => {
    const block = { supplier: "Finca", siesaNumber: "FV-1", orderNumber: "P-1", cost: "100", lines: [product], balance: { bags: "5", date: "2026-11-25" } };
    const parsed = createLoadsSchema.parse({ date: "2026-11-18", orderId: "12", plate: "abc 123", notes: "", blocks: JSON.stringify([block]) });
    expect(parsed.blocks[0]?.balance).toEqual({ bags: 5, date: "2026-11-25", plate: null });
  });
});

describe("balanceTripSchema", () => {
  const trip = { date: "2026-11-26", plate: "abc 123", bags: "3", nextDate: "", nextPlate: "" };

  it("parses a trip that carries the whole rest", () => {
    expect(balanceTripSchema.parse(trip)).toEqual({ date: "2026-11-26", plate: "ABC-123", bags: 3, nextDate: null, nextPlate: null });
  });

  it("parses the new schedule for the rest", () => {
    expect(balanceTripSchema.parse({ ...trip, nextDate: "2026-11-30", nextPlate: "xyz 987" })).toMatchObject({
      nextDate: "2026-11-30",
      nextPlate: "XYZ-987",
    });
  });

  it("requires the plate, the date and whole bags above zero", () => {
    const issue = (input: unknown) => {
      const r = balanceTripSchema.safeParse(input);
      return r.success ? null : r.error.issues[0]?.message;
    };
    expect(issue({ ...trip, plate: "" })).toBe("Elige la placa del viaje.");
    expect(issue({ ...trip, date: "" })).toBe("La fecha del viaje: ingresa una fecha válida.");
    for (const bags of ["", "0", "1,5", "x"]) {
      expect(issue({ ...trip, bags })).toBe("Los bultos del viaje deben ser un número entero mayor que cero.");
    }
  });

  it("rejects a new date that is not a date", () => {
    expect(balanceTripSchema.safeParse({ ...trip, nextDate: "mañana" }).success).toBe(false);
  });
});

describe("freeLoadSchema", () => {
  const row = { siesaNumber: " S-1 ", orderNumber: " P-1 ", kg: "12500", cost: "$ 25.000.000" };
  const free = { date: "2026-11-18", supplier: "Finca", plate: "abc 123", notes: "", rows: JSON.stringify([row]) };
  const withRows = (rows: unknown[]) => ({ ...free, rows: JSON.stringify(rows) });
  const issue = (input: unknown) => {
    const r = freeLoadSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("parses a valid form", () => {
    expect(freeLoadSchema.parse(free)).toEqual({
      date: "2026-11-18",
      supplier: "Finca",
      plate: "ABC-123",
      notes: null,
      rows: [{ siesaNumber: "S-1", orderNumber: "P-1", kg: 12_500, cost: 25_000_000 }],
    });
  });

  it("needs at least one row and rejects malformed JSON", () => {
    expect(issue(withRows([]))).toBe("Agrega al menos un SIESA.");
    expect(issue({ ...free, rows: "{" })).toBe("Las filas del cargue no son válidas.");
  });

  it("needs SIESA, pedido, whole kilos above zero and a value above zero", () => {
    expect(issue(withRows([{ ...row, siesaNumber: " " }]))).toBe("Ingresa el número SIESA de cada fila.");
    expect(issue(withRows([{ ...row, orderNumber: "" }]))).toBe("Ingresa el número de pedido proveedor de cada fila.");
    expect(issue(withRows([{ ...row, kg: "0" }]))).toBe("Los kilos de cada fila deben ser un número entero mayor que cero.");
    expect(issue(withRows([{ ...row, kg: "1,5" }]))).toBe("Los kilos de cada fila deben ser un número entero mayor que cero.");
    expect(issue(withRows([{ ...row, cost: "$ 0" }]))).toBe("El valor de cada fila debe ser mayor que cero.");
    expect(issue(withRows([{ ...row, cost: "" }]))).toBe("El valor de cada fila debe ser mayor que cero.");
  });

  it("refuses a repeated SIESA, and the supplier and plate are required", () => {
    expect(issue(withRows([row, { ...row, orderNumber: "P-2" }]))).toBe("El número SIESA S-1 está repetido en el cargue.");
    expect(issue({ ...free, supplier: "Otro" })).toBe("Elige el proveedor.");
    expect(issue({ ...free, plate: "" })).toBe("Elige la placa del vehículo.");
  });
});
