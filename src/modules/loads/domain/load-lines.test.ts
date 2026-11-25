import { describe, expect, it } from "vitest";
import {
  draftsTotals,
  firstDuplicate,
  isDraftComplete,
  loadTotals,
  reconcileDrafts,
  suggestLines,
  type LineDraft,
} from "./load-lines";

const order = (id: number, lines: Array<{ id: number; name: string; bags: number }>) => ({
  id,
  lines: lines.map((l) => ({ referenceId: l.id, referenceName: l.name, referenceCode: `C${l.id}`, bags: l.bags })),
});

const draft = (over: Partial<LineDraft>): LineDraft => ({
  key: 0,
  orderId: 1,
  referenceId: null,
  reference: "",
  tons: "",
  cost: "",
  siesaNumber: "",
  orderNumber: "",
  auto: false,
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

describe("reconcileDrafts", () => {
  const suggestions = [
    { orderId: 1, referenceId: 1, referenceName: "Engorde 40", referenceCode: "114040", tons: 7.2 },
    { orderId: 1, referenceId: 2, referenceName: "Levante", referenceCode: null, tons: 2 },
  ];
  const checked = new Set([1]);

  it("creates an automatic line for each product of a checked order, labelled with its code", () => {
    const next = reconcileDrafts([], suggestions, checked, 0);
    expect(next.map((d) => [d.orderId, d.referenceId, d.reference, d.tons, d.auto])).toEqual([
      [1, 1, "114040 · Engorde 40", "7.2", true],
      [1, 2, "Levante", "2", true],
    ]);
    expect(new Set(next.map((d) => d.key)).size).toBe(2);
  });

  it("keeps what the user filled in for a product that stays", () => {
    const filled = draft({
      key: 3,
      referenceId: 1,
      reference: "114040 · Engorde 40",
      tons: "7.5",
      cost: "1000",
      siesaNumber: "S-1",
      orderNumber: "P-1",
    });
    const next = reconcileDrafts([filled], suggestions, checked, 4);
    expect(next[0]).toEqual(filled);
    expect(next).toHaveLength(2);
  });

  it("keeps the extra lines a product was split into without suggesting it again", () => {
    const first = draft({ key: 0, referenceId: 1, tons: "4", auto: false });
    const second = draft({ key: 1, referenceId: 1, tons: "3.2", auto: false });
    const next = reconcileDrafts([first, second], suggestions, checked, 2);
    expect(next.map((d) => [d.key, d.referenceId])).toEqual([[0, 1], [1, 1], [2, 2]]);
  });

  it("refreshes the tons of an untouched automatic line", () => {
    const auto = draft({ key: 0, referenceId: 1, reference: "Engorde 40", tons: "3.6", auto: true });
    const next = reconcileDrafts([auto], suggestions, checked, 1);
    expect(next[0]).toMatchObject({ key: 0, tons: "7.2", auto: true });
  });

  it("drops an untouched automatic line whose product left the order", () => {
    const auto = draft({ key: 0, referenceId: 9, reference: "Premium", tons: "1", auto: true });
    expect(reconcileDrafts([auto], suggestions, checked, 1).map((d) => d.referenceId)).toEqual([1, 2]);
  });

  it("drops every line of an order that was unchecked, touched or not", () => {
    const touched = draft({ key: 0, orderId: 5, referenceId: 1, tons: "1", cost: "5" });
    const untouched = draft({ key: 1, orderId: 5, referenceId: 2, auto: true });
    expect(reconcileDrafts([touched, untouched], suggestions, checked, 2).map((d) => d.orderId)).toEqual([1, 1]);
  });

  it("keeps the same product of two orders apart", () => {
    const two = [...suggestions, { orderId: 2, referenceId: 1, referenceName: "Engorde 40", referenceCode: "114040", tons: 1 }];
    const next = reconcileDrafts([], two, new Set([1, 2]), 0);
    expect(next.map((d) => [d.orderId, d.referenceId])).toEqual([[1, 1], [1, 2], [2, 1]]);
  });

  it("drops the automatic lines when no order is checked", () => {
    expect(reconcileDrafts([draft({ key: 0, referenceId: 1, reference: "Engorde 40", auto: true })], [], new Set(), 1)).toEqual([]);
  });
});

describe("isDraftComplete", () => {
  const full = draft({ referenceId: 4, tons: "7,2", cost: "1.500.000", siesaNumber: "123", orderNumber: "P-9" });

  it("accepts a line with every field filled", () => {
    expect(isDraftComplete(full)).toBe(true);
  });

  it.each([
    ["product", { referenceId: null }],
    ["tons blank", { tons: "" }],
    ["tons zero", { tons: "0" }],
    ["tons not a number", { tons: "abc" }],
    ["cost blank", { cost: "" }],
    ["cost zero", { cost: "0" }],
    ["siesa", { siesaNumber: " " }],
    ["supplier order", { orderNumber: "" }],
  ])("rejects a line with %s missing or invalid", (_name, over) => {
    expect(isDraftComplete({ ...full, ...over })).toBe(false);
  });
});

describe("draftsTotals", () => {
  it("counts the lines and adds what was typed, ignoring what cannot be read", () => {
    expect(
      draftsTotals([
        draft({ tons: "7,2", cost: "1.500.000" }),
        draft({ tons: "0,1", cost: "2.000" }),
        draft({ tons: "x", cost: "" }),
      ]),
    ).toEqual({ count: 3, tons: 7.3, cost: 1502000 });
  });
});
