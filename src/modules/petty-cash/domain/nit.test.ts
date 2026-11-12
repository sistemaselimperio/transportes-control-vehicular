import { describe, expect, it } from "vitest";
import { formatNit, normalizeNit } from "./nit";

describe("normalizeNit", () => {
  it("keeps only the digits", () => {
    expect(normalizeNit("1.073.382.044")).toBe("1073382044");
    expect(normalizeNit(" 900 123 456 ")).toBe("900123456");
    expect(normalizeNit("c.c. 12")).toBe("12");
  });

  it("returns an empty string when there are no digits", () => {
    expect(normalizeNit("")).toBe("");
    expect(normalizeNit("abc")).toBe("");
  });
});

describe("formatNit", () => {
  it("groups the digits by thousands with dots", () => {
    expect(formatNit("1073382044")).toBe("1.073.382.044");
    expect(formatNit("900123456")).toBe("900.123.456");
    expect(formatNit("12345")).toBe("12.345");
  });

  it("leaves short numbers alone", () => {
    expect(formatNit("123")).toBe("123");
    expect(formatNit("")).toBe("");
  });

  it("formats an already formatted or dirty value", () => {
    expect(formatNit("1.073.382.044")).toBe("1.073.382.044");
    expect(formatNit("900123456-7")).toBe("9.001.234.567");
  });
});
