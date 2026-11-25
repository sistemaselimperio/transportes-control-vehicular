import { describe, expect, it } from "vitest";
import {
  assertCanAnnul,
  assertCanDeleteReceipt,
  assertCanEditReceipt,
  assertCanPay,
  assertCanSettle,
  CoteroError,
  isPaymentMethod,
  receiptStatusAfterAnnul,
  receiptStatusAfterPay,
  receiptStatusOnSettle,
} from "./settlement-rules";

describe("receipt edits", () => {
  it("only pending receipts can be edited or deleted", () => {
    expect(() => assertCanEditReceipt("pending")).not.toThrow();
    expect(() => assertCanEditReceipt("settled")).toThrow(CoteroError);
    expect(() => assertCanEditReceipt("paid")).toThrow(CoteroError);
    expect(() => assertCanDeleteReceipt("pending")).not.toThrow();
    expect(() => assertCanDeleteReceipt("settled")).toThrow(CoteroError);
    expect(() => assertCanDeleteReceipt("paid")).toThrow(CoteroError);
  });
});

describe("settling receipts", () => {
  it("only pending receipts can be included in a settlement", () => {
    expect(() => assertCanSettle(["pending", "pending"])).not.toThrow();
    expect(() => assertCanSettle(["pending", "settled"])).toThrow(CoteroError);
    expect(() => assertCanSettle(["paid"])).toThrow(CoteroError);
  });

  it("needs at least one receipt", () => {
    expect(() => assertCanSettle([])).toThrow(CoteroError);
  });

  it("marks the receipts as settled", () => {
    expect(receiptStatusOnSettle()).toBe("settled");
  });
});

describe("settlement state", () => {
  it("can be annulled only while it is open (not paid, not already annulled)", () => {
    expect(() => assertCanAnnul("open")).not.toThrow();
    expect(() => assertCanAnnul("paid")).toThrow(CoteroError);
    expect(() => assertCanAnnul("annulled")).toThrow(CoteroError);
  });

  it("can be paid only while it is open", () => {
    expect(() => assertCanPay("open")).not.toThrow();
    expect(() => assertCanPay("paid")).toThrow(CoteroError);
    expect(() => assertCanPay("annulled")).toThrow(CoteroError);
  });

  it("sends the receipts back to pending on annul and to paid on pay", () => {
    expect(receiptStatusAfterAnnul()).toBe("pending");
    expect(receiptStatusAfterPay()).toBe("paid");
  });

  it("explains why a paid settlement is closed", () => {
    expect(() => assertCanAnnul("paid")).toThrow(/pagada/i);
  });
});

describe("isPaymentMethod", () => {
  it("knows the five methods", () => {
    for (const m of ["efectivo", "transferencia", "nequi", "daviplata", "otro"]) expect(isPaymentMethod(m)).toBe(true);
    expect(isPaymentMethod("cheque")).toBe(false);
    expect(isPaymentMethod("")).toBe(false);
  });
});
