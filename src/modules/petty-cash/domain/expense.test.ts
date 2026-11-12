import { describe, expect, it } from "vitest";
import { isExpensePending, isResponsibilityType, RESPONSIBILITY_LABELS, sumExpenses } from "./expense";

describe("isExpensePending", () => {
  const nit = "900123";

  it("is complete when it has a NIT, a billed company and a responsibility type", () => {
    expect(isExpensePending({ nit, company: "FABIAN PAEZ", responsibilityType: "none_active" })).toBe(false);
    expect(isExpensePending({ nit, company: "Y", responsibilityType: "electronic_invoicer" })).toBe(false);
  });

  it("is pending without a company", () => {
    expect(isExpensePending({ nit, company: null, responsibilityType: "none_active" })).toBe(true);
    expect(isExpensePending({ nit, company: "   ", responsibilityType: "none_active" })).toBe(true);
  });

  it("is pending without a responsibility type", () => {
    expect(isExpensePending({ nit, company: "Y", responsibilityType: null })).toBe(true);
  });

  it("is pending without a NIT", () => {
    expect(isExpensePending({ nit: null, company: "Y", responsibilityType: "none_active" })).toBe(true);
    expect(isExpensePending({ nit: "", company: "Y", responsibilityType: "none_active" })).toBe(true);
  });
});

describe("responsibility types", () => {
  it("labels both types as the sheet writes them", () => {
    expect(RESPONSIBILITY_LABELS.none_active).toBe("SIN RESPONSABILIDAD ACTIVA");
    expect(RESPONSIBILITY_LABELS.electronic_invoicer).toBe("FACTURADOR ELECTRONICO");
  });

  it("recognizes only known values", () => {
    expect(isResponsibilityType("none_active")).toBe(true);
    expect(isResponsibilityType("other")).toBe(false);
    expect(isResponsibilityType(null)).toBe(false);
  });
});

describe("sumExpenses", () => {
  it("adds the values", () => {
    expect(sumExpenses([{ value: 1000 }, { value: 250 }])).toBe(1250);
  });

  it("is zero without expenses", () => {
    expect(sumExpenses([])).toBe(0);
  });

  it("counts an expense without a value as zero", () => {
    expect(sumExpenses([{ value: 1000 }, { value: null }])).toBe(1000);
  });
});
