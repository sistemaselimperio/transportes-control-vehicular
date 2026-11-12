import { describe, expect, it } from "vitest";
import { expenseIdSchema, expenseSchema, ledgerIdSchema, ledgerSchema } from "./petty-cash-schemas";

describe("ledgerSchema", () => {
  const valid = { date: "2026-11-07", compenseAmount: "1.500.000" };

  it("parses the date and the compense amount", () => {
    expect(ledgerSchema.parse(valid)).toEqual({ date: "2026-11-07", compenseAmount: 1_500_000, openingBalance: null });
  });

  it("parses the opening balance when it is typed", () => {
    expect(ledgerSchema.parse({ ...valid, openingBalance: "250.000" }).openingBalance).toBe(250_000);
  });

  it("requires a valid date", () => {
    expect(() => ledgerSchema.parse({ ...valid, date: "" })).toThrow();
    expect(() => ledgerSchema.parse({ ...valid, date: "2026-13-45" })).toThrow();
  });

  it("requires the compense amount", () => {
    expect(() => ledgerSchema.parse({ date: "2026-11-07", compenseAmount: "" })).toThrow();
    expect(() => ledgerSchema.parse({ ...valid, compenseAmount: "abc" })).toThrow();
  });
});

describe("expenseSchema", () => {
  const valid = {
    detail: "Resma de papel",
    nit: "1.073.382.044",
    vehicle: "abc 123",
    value: "45.000",
  };

  it("parses the required fields and nulls the optional ones", () => {
    expect(expenseSchema.parse(valid)).toEqual({
      detail: "Resma de papel",
      invoiceNumber: null,
      efk: null,
      nit: "1073382044",
      supplierName: null,
      company: null,
      responsibilityType: null,
      vehicle: "abc 123",
      value: 45_000,
    });
  });

  it("keeps the optional fields when typed", () => {
    const parsed = expenseSchema.parse({
      ...valid,
      invoiceNumber: " FE-12 ",
      supplierName: " Papelería X ",
      company: " FABIAN PAEZ ",
      responsibilityType: "electronic_invoicer",
    });
    expect(parsed.invoiceNumber).toBe("FE-12");
    expect(parsed.supplierName).toBe("Papelería X");
    expect(parsed.company).toBe("FABIAN PAEZ");
    expect(parsed.responsibilityType).toBe("electronic_invoicer");
  });

  it("trims the EFK, nulls it when empty and refuses more than 50 characters", () => {
    expect(expenseSchema.parse({ ...valid, efk: "  EFK-123 " }).efk).toBe("EFK-123");
    expect(expenseSchema.parse({ ...valid, efk: "   " }).efk).toBeNull();
    expect(expenseSchema.parse({ ...valid, efk: "x".repeat(50) }).efk).toHaveLength(50);
    expect(expenseSchema.safeParse({ ...valid, efk: "x".repeat(51) }).success).toBe(false);
  });

  it("treats an empty responsibility as not provided and refuses an unknown one", () => {
    expect(expenseSchema.parse({ ...valid, responsibilityType: "" }).responsibilityType).toBeNull();
    expect(() => expenseSchema.parse({ ...valid, responsibilityType: "x" })).toThrow();
  });

  it.each(["detail", "nit", "vehicle", "value"] as const)("requires %s", (field) => {
    expect(() => expenseSchema.parse({ ...valid, [field]: "  " })).toThrow();
  });

  it("refuses a NIT with too few digits", () => {
    expect(() => expenseSchema.parse({ ...valid, nit: "12" })).toThrow();
  });

  it("refuses a value of zero", () => {
    expect(() => expenseSchema.parse({ ...valid, value: "0" })).toThrow();
  });
});

describe("ids", () => {
  it("accept positive integers only", () => {
    expect(ledgerIdSchema.parse(3)).toBe(3);
    expect(expenseIdSchema.parse(3)).toBe(3);
    expect(() => ledgerIdSchema.parse(0)).toThrow();
    expect(() => expenseIdSchema.parse("1")).toThrow();
  });
});
