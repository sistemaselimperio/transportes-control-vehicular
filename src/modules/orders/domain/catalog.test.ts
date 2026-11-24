import { describe, expect, it } from "vitest";
import { productLabel, productLabelWithSupplier, productsOfSupplier, searchProducts, type CatalogProduct } from "./catalog";

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  id: 1,
  code: "132240",
  name: "Finca Pollitas Iniciación",
  supplier: "Finca",
  ...over,
});

const catalog: CatalogProduct[] = [
  product({ id: 1 }),
  product({ id: 2, code: "132240", name: "C.POLLITAS INICIACION C.", supplier: "Contegral" }),
  product({ id: 3, code: "350540C", name: "C.CONTERUMIN DESTETOS CARNE P.", supplier: "Contegral" }),
  product({ id: 4, code: "302040", name: "Terneras Nodriza" }),
  product({ id: 5, code: "302540", name: "Terneras Nodriza" }),
];

describe("productLabel", () => {
  it("joins the code and the name", () => {
    expect(productLabel({ code: "350540C", name: "Destetos" })).toBe("350540C · Destetos");
  });

  it("falls back to the name for a legacy product without code", () => {
    expect(productLabel({ code: null, name: "Engorde 40" })).toBe("Engorde 40");
  });
});

describe("productLabelWithSupplier", () => {
  it("puts the supplier first, as the order form lists products of every supplier", () => {
    expect(productLabelWithSupplier(product({ code: "350540C", name: "Destetos", supplier: "Contegral" }))).toBe(
      "Contegral · 350540C · Destetos",
    );
  });
});

describe("productsOfSupplier", () => {
  it("keeps only the products of that supplier", () => {
    expect(productsOfSupplier(catalog, "Contegral").map((p) => p.id)).toEqual([2, 3]);
  });

  it("is empty for a supplier without products or none chosen", () => {
    expect(productsOfSupplier(catalog, "Italcol")).toEqual([]);
    expect(productsOfSupplier(catalog, null)).toEqual([]);
  });
});

describe("searchProducts", () => {
  it("matches by code, ignoring case", () => {
    expect(searchProducts(catalog, "350540c").map((p) => p.id)).toEqual([3]);
  });

  it("matches every word against the name or the supplier, ignoring accents", () => {
    expect(searchProducts(catalog, "iniciacion contegral").map((p) => p.id)).toEqual([2]);
    expect(searchProducts(catalog, "pollitas inicia").map((p) => p.id)).toEqual([1, 2]);
  });

  it("tells apart products that share a name", () => {
    expect(searchProducts(catalog, "nodriza 3025").map((p) => p.id)).toEqual([5]);
  });

  it("returns everything for a blank query, up to the limit", () => {
    expect(searchProducts(catalog, "  ")).toHaveLength(5);
    expect(searchProducts(catalog, "", 2).map((p) => p.id)).toEqual([1, 2]);
  });
});
