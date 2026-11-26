import { describe, expect, it } from "vitest";
import { firstDuplicate, freeLoadRows, freeRowsError, groupLinesByOrder, isFreeLoad, loadTotals, splitCost, suggestLines, type LoadLineRow } from "./load-lines";

const order = (id: number, lines: Array<{ id: number; name: string; bags: number }>) => ({
  id,
  lines: lines.map((l) => ({ referenceId: l.id, referenceName: l.name, referenceCode: `C${l.id}`, bags: l.bags })),
});

const row = (over: Partial<LoadLineRow>): LoadLineRow => ({
  id: 1,
  orderId: 1,
  referenceId: 1,
  referenceName: "Engorde",
  referenceCode: "C1",
  tons: 1,
  cost: 100,
  siesaNumber: "S-1",
  orderNumber: "P-1",
  ...over,
});

describe("loadTotals", () => {
  it("adds the tons and the cost of the lines without float noise", () => {
    expect(
      loadTotals([
        { tons: 0.1, cost: 100 },
        { tons: 0.2, cost: 250 },
      ]),
    ).toEqual({ tons: 0.3, cost: 350 });
  });

  it("is zero without lines", () => {
    expect(loadTotals([])).toEqual({ tons: 0, cost: 0 });
  });
});

describe("firstDuplicate", () => {
  it("finds the first repeated number, ignoring blanks", () => {
    expect(firstDuplicate(["A", "B", "A", "B"])).toBe("A");
    expect(firstDuplicate(["A", "B"])).toBeNull();
    expect(firstDuplicate(["", ""])).toBeNull();
  });
});

describe("suggestLines", () => {
  it("suggests one line per product of each order, in order of appearance", () => {
    const orders = [
      order(7, [
        { id: 1, name: "Engorde 40", bags: 100 },
        { id: 2, name: "Levante", bags: 50 },
      ]),
      order(8, [{ id: 1, name: "Engorde 40", bags: 80 }]),
    ];
    // 100 bags * 40 kg = 4 t; 50 bags * 40 kg = 2 t; 80 bags * 40 kg = 3.2 t: an order is never mixed with another.
    expect(suggestLines(orders, 40)).toEqual([
      { orderId: 7, referenceId: 1, referenceName: "Engorde 40", referenceCode: "C1", tons: 4 },
      { orderId: 7, referenceId: 2, referenceName: "Levante", referenceCode: "C2", tons: 2 },
      { orderId: 8, referenceId: 1, referenceName: "Engorde 40", referenceCode: "C1", tons: 3.2 },
    ]);
  });

  it("adds the bags of a product repeated inside one order", () => {
    const orders = [order(7, [{ id: 1, name: "Engorde 40", bags: 60 }, { id: 1, name: "Engorde 40", bags: 40 }])];
    expect(suggestLines(orders, 40).map((s) => [s.referenceId, s.tons])).toEqual([[1, 4]]);
  });

  it("keeps apart two products that share a name", () => {
    const orders = [
      order(7, [
        { id: 1, name: "Terneras Nodriza", bags: 25 },
        { id: 2, name: "Terneras Nodriza", bags: 25 },
      ]),
    ];
    expect(suggestLines(orders, 40).map((s) => [s.referenceId, s.tons])).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it("is empty without orders", () => {
    expect(suggestLines([], 40)).toEqual([]);
  });
});


describe("splitCost", () => {
  it("splits in proportion to the tons and always adds up to the total", () => {
    expect(splitCost(1_000_000, [30, 10])).toEqual([750_000, 250_000]);
    const shares = splitCost(1_000_000, [1, 1, 1]);
    expect(shares).toEqual([333_333, 333_333, 333_334]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1_000_000);
  });

  it("gives the whole cost to a single line", () => {
    expect(splitCost(1_234_567, [12.5])).toEqual([1_234_567]);
  });

  it("keeps whole pesos for awkward weights", () => {
    const shares = splitCost(999_999, [2.345, 7.891, 0.5]);
    expect(shares.every(Number.isInteger)).toBe(true);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(999_999);
  });

  it("is zero for a zero cost and empty without lines", () => {
    expect(splitCost(0, [1, 2])).toEqual([0, 0]);
    expect(splitCost(100, [])).toEqual([]);
  });

  it("never lets a share go negative", () => {
    expect(splitCost(1, [1, 1, 1]).every((s) => s >= 0)).toBe(true);
  });
});

describe("groupLinesByOrder", () => {
  it("groups by order in order of appearance, adding tons and cost", () => {
    const groups = groupLinesByOrder([
      row({ id: 1, orderId: 7, tons: 0.1, cost: 100 }),
      row({ id: 2, orderId: 8, tons: 5, cost: 900, siesaNumber: "S-2", orderNumber: "P-2" }),
      row({ id: 3, orderId: 7, tons: 0.2, cost: 250 }),
    ]);
    expect(groups.map((g) => [g.orderId, g.tons, g.cost, g.siesaNumbers, g.orderNumbers, g.lines.length])).toEqual([
      [7, 0.3, 350, ["S-1"], ["P-1"], 2],
      [8, 5, 900, ["S-2"], ["P-2"], 1],
    ]);
  });

  it("lists every distinct SIESA of an order made line by line", () => {
    const [group] = groupLinesByOrder([row({ id: 1, siesaNumber: "S-1" }), row({ id: 2, siesaNumber: "S-9" }), row({ id: 3, siesaNumber: "S-1" })]);
    expect(group?.siesaNumbers).toEqual(["S-1", "S-9"]);
  });
});

describe("free loads (lines without an order)", () => {
  it("detects a free load: it has lines and none belongs to an order", () => {
    expect(isFreeLoad([row({ orderId: null, referenceId: null })])).toBe(true);
    expect(isFreeLoad([row({ orderId: null }), row({ orderId: 3 })])).toBe(false);
    expect(isFreeLoad([row({ orderId: 3 })])).toBe(false);
    expect(isFreeLoad([])).toBe(false);
  });

  it("groupLinesByOrder skips the lines without an order", () => {
    const groups = groupLinesByOrder([row({ orderId: null }), row({ id: 2, orderId: 5 })]);
    expect(groups.map((g) => g.orderId)).toEqual([5]);
  });

  it("builds one row per (SIESA, supplier order) with whole kilos and the summed cost", () => {
    const rows = freeLoadRows([
      row({ orderId: null, siesaNumber: "S-1", orderNumber: "P-1", tons: 1.2345, cost: 100 }),
      row({ id: 2, orderId: null, siesaNumber: "S-1", orderNumber: "P-1", tons: 0.5, cost: 50 }),
      row({ id: 3, orderId: null, siesaNumber: "S-2", orderNumber: "P-1", tons: 2, cost: 70 }),
    ]);
    expect(rows).toEqual([
      { siesaNumber: "S-1", orderNumber: "P-1", kg: 1735, cost: 150 },
      { siesaNumber: "S-2", orderNumber: "P-1", kg: 2000, cost: 70 },
    ]);
  });
});

describe("freeRowsError", () => {
  const ok = { siesaNumber: "S-1", orderNumber: "P-1", kg: 1000, cost: 5000 };
  it("accepts complete rows", () => expect(freeRowsError([ok])).toBeNull());
  it("needs at least one row", () => expect(freeRowsError([])).toBe("Agrega al menos un SIESA."));
  it("needs SIESA, pedido, kilos and value in every row", () => {
    const message = "Completa el SIESA, el pedido proveedor, los kilos y el valor de cada fila.";
    expect(freeRowsError([{ ...ok, siesaNumber: " " }])).toBe(message);
    expect(freeRowsError([{ ...ok, orderNumber: "" }])).toBe(message);
    expect(freeRowsError([{ ...ok, kg: 0 }])).toBe(message);
    expect(freeRowsError([{ ...ok, cost: 0 }])).toBe(message);
    expect(freeRowsError([{ ...ok, kg: 1.5 }])).toBe(message);
  });
  it("refuses a repeated SIESA", () => {
    expect(freeRowsError([ok, { ...ok, orderNumber: "P-2" }])).toBe("El número SIESA S-1 está repetido en el cargue.");
  });
});
