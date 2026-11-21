import { describe, expect, it } from "vitest";
import {
  draftsTotals,
  firstDuplicate,
  isDraftComplete,
  loadTotals,
  orderedVersusLoaded,
  reconcileDrafts,
  suggestLines,
  type LineDraft,
} from "./load-lines";

const order = (lines: Array<{ ref: string; bags: number }>) => ({
  lines: lines.map((l) => ({ referenceName: l.ref, bags: l.bags })),
});

const draft = (over: Partial<LineDraft>): LineDraft => ({
  key: 0,
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
  it("adds one line per reference across the orders, in order of appearance", () => {
    const orders = [
      order([
        { ref: "Engorde 40", bags: 100 },
        { ref: "Levante", bags: 50 },
      ]),
      order([{ ref: "engorde 40", bags: 80 }]),
    ];
    // 180 bags * 40 kg = 7.2 t; 50 bags * 40 kg = 2 t.
    expect(suggestLines(orders, 40)).toEqual([
      { referenceName: "Engorde 40", tons: 7.2 },
      { referenceName: "Levante", tons: 2 },
    ]);
  });

  it("is empty without orders", () => {
    expect(suggestLines([], 40)).toEqual([]);
  });
});

describe("reconcileDrafts", () => {
  const suggestions = [
    { referenceName: "Engorde 40", tons: 7.2 },
    { referenceName: "Levante", tons: 2 },
  ];

  it("creates an automatic line for each new reference", () => {
    const next = reconcileDrafts([], suggestions, 0);
    expect(next.map((d) => [d.reference, d.tons, d.auto])).toEqual([
      ["Engorde 40", "7.2", true],
      ["Levante", "2", true],
    ]);
    expect(new Set(next.map((d) => d.key)).size).toBe(2);
  });

  it("keeps what the user filled in for a reference that stays", () => {
    const filled = draft({ key: 3, reference: "engorde 40", tons: "7.5", cost: "1000", siesaNumber: "S-1", orderNumber: "P-1" });
    const next = reconcileDrafts([filled], suggestions, 4);
    expect(next[0]).toEqual(filled);
    expect(next).toHaveLength(2);
  });

  it("refreshes the tons of an untouched automatic line", () => {
    const auto = draft({ key: 0, reference: "Engorde 40", tons: "3.6", auto: true });
    const next = reconcileDrafts([auto], suggestions, 1);
    expect(next[0]).toMatchObject({ key: 0, tons: "7.2", auto: true });
  });

  it("drops an untouched automatic line whose reference left the orders", () => {
    const auto = draft({ key: 0, reference: "Premium", tons: "1", auto: true });
    expect(reconcileDrafts([auto], suggestions, 1).map((d) => d.reference)).toEqual(["Engorde 40", "Levante"]);
  });

  it("keeps manual lines and automatic ones the user already filled in", () => {
    const manual = draft({ key: 0, reference: "Sal mineral", tons: "1" });
    const edited = draft({ key: 1, reference: "Premium", tons: "1", cost: "5", auto: false });
    const next = reconcileDrafts([manual, edited], [], 2);
    expect(next).toEqual([manual, edited]);
  });

  it("drops a blank automatic line when no order is checked", () => {
    expect(reconcileDrafts([draft({ key: 0, reference: "Engorde 40", auto: true })], [], 1)).toEqual([]);
  });
});

describe("orderedVersusLoaded", () => {
  const suggestions = [
    { referenceName: "Engorde 40", tons: 7.2 },
    { referenceName: "Levante", tons: 2 },
  ];

  it("compares the ordered tons with the loaded ones per product", () => {
    const rows = orderedVersusLoaded(
      [draft({ reference: " engorde 40 ", tons: "7,5" }), draft({ key: 1, reference: "Engorde 40", tons: "0.1" })],
      suggestions,
    );
    expect(rows).toEqual([
      { referenceName: "Engorde 40", ordered: 7.2, loaded: 7.6, difference: 0.4 },
      { referenceName: "Levante", ordered: 2, loaded: 0, difference: -2 },
    ]);
  });
});

describe("isDraftComplete", () => {
  const full = draft({ reference: "Maxi-Leche", tons: "7,2", cost: "1.500.000", siesaNumber: "123", orderNumber: "P-9" });

  it("accepts a line with every field filled", () => {
    expect(isDraftComplete(full)).toBe(true);
  });

  it.each([
    ["reference", { reference: "  " }],
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
