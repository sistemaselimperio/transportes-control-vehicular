import { describe, expect, it } from "vitest";
import { normalizeReceiptNumber } from "./receipt-number";

describe("normalizeReceiptNumber", () => {
  it("joins the letter and the digits with a hyphen, keeping the digits as written", () => {
    expect(normalizeReceiptNumber("T 0248")).toBe("T-0248");
    expect(normalizeReceiptNumber("T 428")).toBe("T-428");
    expect(normalizeReceiptNumber("t-0248")).toBe("T-0248");
    expect(normalizeReceiptNumber("T0248")).toBe("T-0248");
    expect(normalizeReceiptNumber("  t   248 ")).toBe("T-248");
  });

  it("keeps different digit strings apart", () => {
    expect(normalizeReceiptNumber("T 0428")).not.toBe(normalizeReceiptNumber("T 428"));
  });

  it("accepts a number without a letter", () => {
    expect(normalizeReceiptNumber("0248")).toBe("0248");
  });

  it("reads the digit-like letters of handwriting only as typed (no guessing)", () => {
    expect(normalizeReceiptNumber("TA 12")).toBe("TA-12");
  });

  it("is null when there are no digits", () => {
    expect(normalizeReceiptNumber("")).toBeNull();
    expect(normalizeReceiptNumber("   ")).toBeNull();
    expect(normalizeReceiptNumber("T")).toBeNull();
    expect(normalizeReceiptNumber("sin número")).toBeNull();
  });

  it("is null for text that is not a receipt number", () => {
    expect(normalizeReceiptNumber("T 12 34")).toBeNull();
    expect(normalizeReceiptNumber("12345678901234567890")).toBeNull();
  });
});
