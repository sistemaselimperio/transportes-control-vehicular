import { describe, expect, it } from "vitest";
import { bagsOf, emptyRow, isBlankRow, productRowError, serializeOrder, withTrailingRow, type ProductRow } from "./order-draft";

const row = (key: number, over: Partial<ProductRow> = {}): ProductRow => ({ ...emptyRow(key), ...over });
const inCatalog = new Set([1, 2, 3]);

describe("withTrailingRow", () => {
  it("adds an empty row when the last one has a product", () => {
    const rows = withTrailingRow([row(0, { referenceId: 1 })], 100);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(emptyRow(1));
  });

  it("keeps the rows when the last one is still empty", () => {
    const rows = [row(0, { referenceId: 1 }), row(1)];
    expect(withTrailingRow(rows, 100)).toBe(rows);
  });

  it("always leaves at least one row", () => {
    expect(withTrailingRow([], 100)).toEqual([emptyRow(0)]);
  });

  it("does not pass the maximum", () => {
    const rows = [row(0, { referenceId: 1 }), row(1, { referenceId: 2 })];
    expect(withTrailingRow(rows, 2)).toBe(rows);
  });

  it("gives the new row an unused key", () => {
    const rows = withTrailingRow([row(4, { referenceId: 1 }), row(7, { referenceId: 2 })], 100);
    expect(rows[2]?.key).toBe(8);
  });
});

describe("rows", () => {
  it("tells a blank row from a started one", () => {
    expect(isBlankRow(row(0))).toBe(true);
    expect(isBlankRow(row(0, { bags: "  " }))).toBe(true);
    expect(isBlankRow(row(0, { bags: "3" }))).toBe(false);
    expect(isBlankRow(row(0, { referenceId: 1 }))).toBe(false);
    expect(isBlankRow(row(0, { legacyText: "Viejo" }))).toBe(false);
  });

  it("reads bags as a positive whole number, else 0", () => {
    expect(bagsOf(row(0, { bags: " 12 " }))).toBe(12);
    for (const bags of ["", "0", "1.5", "-2", "abc"]) expect(bagsOf(row(0, { bags }))).toBe(0);
  });

  it("reports half-filled rows and legacy products by their position", () => {
    expect(productRowError([row(0, { referenceId: 1, bags: "5" }), row(1)], inCatalog)).toBeNull();
    expect(productRowError([row(0, { referenceId: 1, bags: "5" }), row(1, { bags: "5" })], inCatalog)).toBe(
      "Elige la referencia del catálogo en el producto 2.",
    );
    expect(productRowError([row(0, { referenceId: 1 })], inCatalog)).toBe("Indica los bultos del producto 1.");
    expect(productRowError([row(0, { referenceId: 1, bags: "0" })], inCatalog)).toBe("Indica los bultos del producto 1.");
    expect(productRowError([row(0, { referenceId: 99, legacyText: "Viejo", bags: "5" })], inCatalog)).toBe(
      "Elige la referencia del catálogo en el producto 1.",
    );
  });

  it("asks for at least one product", () => {
    expect(productRowError([row(0)], inCatalog)).toBe("Agrega al menos un producto al pedido.");
  });
});

describe("serializeOrder", () => {
  it("sends the client, the finca and only the filled rows", () => {
    const rows = [row(0, { referenceId: 1, bags: "5" }), row(1, { referenceId: 2, bags: "7" }), row(2)];
    expect(JSON.parse(serializeOrder({ clientId: 3, locationId: "9", rows }))).toEqual({
      clientId: 3,
      locationId: 9,
      lines: [
        { referenceId: 1, bags: 5 },
        { referenceId: 2, bags: 7 },
      ],
    });
  });

  it("sends no finca when none is chosen and null bags when invalid", () => {
    const sent = JSON.parse(serializeOrder({ clientId: null, locationId: "", rows: [row(0, { referenceId: 1, bags: "x" })] }));
    expect(sent).toEqual({ clientId: null, locationId: null, lines: [{ referenceId: 1, bags: null }] });
  });
});
