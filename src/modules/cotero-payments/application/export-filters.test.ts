import { describe, expect, it } from "vitest";
import { NO_RECEIPT_FILTERS } from "../domain/receipt-rules";
import { receiptFiltersFromParams, receiptFiltersToParams } from "./export-filters";

describe("receiptFiltersFromParams", () => {
  it("reads nothing as no filters", () => {
    expect(receiptFiltersFromParams(new URLSearchParams())).toEqual(NO_RECEIPT_FILTERS);
  });

  it("reads every filter", () => {
    const params = new URLSearchParams("desde=2026-11-01&hasta=2026-11-30&cotero=doc%3A111111&estado=paid&placa=ABC-123&destino=Roble&buscar=Juan");
    expect(receiptFiltersFromParams(params)).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
      coteroKey: "doc:111111",
      search: "Juan",
      status: "paid",
      plate: "ABC-123",
      destination: "Roble",
    });
  });

  it("ignores values that are not valid", () => {
    const params = new URLSearchParams("desde=ayer&hasta=2026-13-45&estado=otro");
    expect(receiptFiltersFromParams(params)).toEqual(NO_RECEIPT_FILTERS);
  });
});

describe("receiptFiltersToParams", () => {
  it("writes only the filters in use and round-trips", () => {
    const filters = { ...NO_RECEIPT_FILTERS, from: "2026-11-01", status: "pending" as const, plate: "ABC" };
    const params = receiptFiltersToParams(filters);
    expect(params.toString()).toBe("desde=2026-11-01&estado=pending&placa=ABC");
    expect(receiptFiltersFromParams(params)).toEqual(filters);
  });

  it("writes the cotero search as buscar", () => {
    const filters = { ...NO_RECEIPT_FILTERS, search: " Juan " };
    expect(receiptFiltersToParams(filters).toString()).toBe("buscar=Juan");
  });

  it("is empty without filters", () => {
    expect(receiptFiltersToParams(NO_RECEIPT_FILTERS).toString()).toBe("");
  });
});
