import { describe, expect, it } from "vitest";
import { boxSchema, entryUpdateSchema, expenseSchema, incomeSchema } from "./daily-cash-schemas";

describe("boxSchema", () => {
  it("reads the date and an optional opening balance with thousands separators", () => {
    expect(boxSchema.parse({ date: "2026-11-26", openingBalance: "1.500.000" })).toEqual({ date: "2026-11-26", openingBalance: 1500000 });
    expect(boxSchema.parse({ date: "2026-11-26" }).openingBalance).toBeNull();
  });

  it("rejects an invalid date", () => {
    expect(() => boxSchema.parse({ date: "26/11/2026" })).toThrow();
  });
});

describe("expenseSchema", () => {
  it("needs the company, a detail and a positive value", () => {
    expect(expenseSchema.parse({ company: "EC1", detail: " Peaje ", value: "12.000" })).toEqual({ company: "EC1", detail: "Peaje", value: 12000 });
    expect(() => expenseSchema.parse({ company: "XX", detail: "Peaje", value: "1" })).toThrow(/empresa/i);
    expect(() => expenseSchema.parse({ company: "EGT", detail: " ", value: "1" })).toThrow(/detalle/i);
    expect(() => expenseSchema.parse({ company: "EGT", detail: "x", value: "0" })).toThrow(/mayor a cero/i);
  });
});

describe("values above int4", () => {
  it("are refused for manual entries", () => {
    expect(() => expenseSchema.parse({ company: "EC1", detail: "x", value: "2.147.483.648" })).toThrow(/grande/i);
    expect(() => incomeSchema.parse({ detail: "x", value: "9999999999" })).toThrow(/grande/i);
  });
});

describe("incomeSchema", () => {
  it("needs a concept and a positive value", () => {
    expect(incomeSchema.parse({ detail: "Recarga almacén", value: "300000" })).toEqual({ detail: "Recarga almacén", value: 300000 });
    expect(() => incomeSchema.parse({ detail: "", value: "1" })).toThrow(/concepto/i);
  });
});

describe("entryUpdateSchema", () => {
  it("turns a missing company into null and keeps a valid one", () => {
    expect(entryUpdateSchema.parse({ detail: "x", value: "5" }).company).toBeNull();
    expect(entryUpdateSchema.parse({ company: "EGT", detail: "x", value: "5" }).company).toBe("EGT");
  });
});
