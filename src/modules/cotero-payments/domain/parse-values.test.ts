import { describe, expect, it } from "vitest";
import { parseCop, parseTons } from "./parse-values";

describe("parseTons", () => {
  it("reads tons with a decimal point or comma", () => {
    expect(parseTons("33.213")).toBe(33.213);
    expect(parseTons("33,213")).toBe(33.213);
    expect(parseTons("12.88 t")).toBe(12.88);
    expect(parseTons("30 Ton")).toBe(30);
    expect(parseTons("30 toneladas")).toBe(30);
  });

  it("converts kilograms to tons, reading dots and commas as thousand separators", () => {
    expect(parseTons("12.880 Kg")).toBe(12.88);
    expect(parseTons("12.880 kg")).toBe(12.88);
    expect(parseTons("12,880 kilos")).toBe(12.88);
    expect(parseTons("33213 KG")).toBe(33.213);
    expect(parseTons("500 kg")).toBe(0.5);
  });

  it("treats a bare number above any plausible load as kilograms", () => {
    expect(parseTons("33213")).toBe(33.213);
    expect(parseTons("12880")).toBe(12.88);
  });

  it("rounds to three decimals", () => {
    expect(parseTons("12.88049")).toBe(12.88);
    expect(parseTons("1234.5678 kg")).toBe(1.235);
  });

  it("is null for blank, zero or non numeric text", () => {
    expect(parseTons("")).toBeNull();
    expect(parseTons("   ")).toBeNull();
    expect(parseTons("0")).toBeNull();
    expect(parseTons("abc")).toBeNull();
    expect(parseTons("-5")).toBeNull();
  });
});

describe("parseCop", () => {
  it("reads handwritten pesos with apostrophes, dots and commas as thousand separators", () => {
    expect(parseCop("$325'498")).toBe(325498);
    expect(parseCop("$126.224")).toBe(126224);
    expect(parseCop("$ 1.250.000")).toBe(1250000);
    expect(parseCop("325,498")).toBe(325498);
    expect(parseCop("325498")).toBe(325498);
    expect(parseCop("$1'250.000")).toBe(1250000);
  });

  it("drops one or two decimals after the last separator", () => {
    expect(parseCop("$126.224,50")).toBe(126224);
    expect(parseCop("126,224.00")).toBe(126224);
  });

  it("is null for blank, zero or text without digits", () => {
    expect(parseCop("")).toBeNull();
    expect(parseCop("$")).toBeNull();
    expect(parseCop("$0")).toBeNull();
    expect(parseCop("abc")).toBeNull();
  });

  it("is null above the storable maximum", () => {
    expect(parseCop("99999999999999")).toBeNull();
  });
});
