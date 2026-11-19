import { describe, expect, it } from "vitest";
import { formatDecimal, parseDecimal } from "./decimal";

describe("parseDecimal", () => {
  it("reads plain numbers", () => {
    expect(parseDecimal("1250")).toBe(1250);
    expect(parseDecimal("1250.5")).toBe(1250.5);
    expect(parseDecimal(" 0.75 ")).toBe(0.75);
  });

  it("accepts a decimal comma", () => {
    expect(parseDecimal("1250,5")).toBe(1250.5);
    expect(parseDecimal("0,75")).toBe(0.75);
  });

  it("treats the last separator as the decimal one when both appear", () => {
    expect(parseDecimal("1.250,5")).toBe(1250.5);
    expect(parseDecimal("1,250.5")).toBe(1250.5);
  });

  it("rejects blanks, text and signs", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("  ")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("12kg")).toBeNull();
    expect(parseDecimal("-5")).toBeNull();
    expect(parseDecimal("1.2.3")).toBeNull();
  });
});

describe("formatDecimal", () => {
  it("groups thousands the Colombian way and trims trailing zeros", () => {
    expect(formatDecimal(1250.5)).toBe("1.250,5");
    expect(formatDecimal(1250)).toBe("1.250");
    expect(formatDecimal(0.5)).toBe("0,5");
  });

  it("caps the decimals", () => {
    expect(formatDecimal(1.23456, 3)).toBe("1,235");
    expect(formatDecimal(1.23456)).toBe("1,23");
  });
});
