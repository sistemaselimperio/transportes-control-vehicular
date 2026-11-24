import { describe, expect, it } from "vitest";
import { assertCapacityTons, formatCapacityTons, parseCapacityTons, parseLegacyCapacityTons } from "./capacity";
import { RuleError } from "./vehicle-rules";

describe("parseCapacityTons", () => {
  it.each([
    ["34", 34],
    ["8.5", 8.5],
    ["8,5", 8.5],
    ["34 t", 34],
    ["34t", 34],
    ["34 ton", 34],
    ["34 TONS", 34],
    ["  12,25 Toneladas ", 12.25],
    ["1 tonelada", 1],
    ["8.555", 8.56],
  ])("reads %j as %d tons", (raw, tons) => {
    expect(parseCapacityTons(raw)).toBe(tons);
  });

  it.each(["", "  ", "abc", "0", "0,00", "-3", "34 pasajeros", "34 kg", "1.000.000", "9999999", "t"])(
    "rejects %j",
    (raw) => {
      expect(parseCapacityTons(raw)).toBeNull();
    },
  );
});

describe("parseLegacyCapacityTons", () => {
  it.each([
    ["34 t", 34],
    ["34t", 34],
    ["8,5 ton", 8.5],
    ["10 Tons", 10],
    ["12 TONELADAS", 12],
    ["1 tonelada", 1],
  ])("converts %j with an explicit unit", (raw, tons) => {
    expect(parseLegacyCapacityTons(raw)).toBe(tons);
  });

  it.each(["2", "34", "8.5", "40 pasajeros", "5 personas", "", "abc", "0 t"])("drops %j", (raw) => {
    expect(parseLegacyCapacityTons(raw)).toBeNull();
  });
});

describe("formatCapacityTons", () => {
  it("shows tons with a comma for decimals", () => {
    expect(formatCapacityTons(34)).toBe("34 t");
    expect(formatCapacityTons(8.5)).toBe("8,5 t");
  });
});

describe("assertCapacityTons", () => {
  it("accepts null and a positive number", () => {
    expect(() => assertCapacityTons(null)).not.toThrow();
    expect(() => assertCapacityTons(8.5)).not.toThrow();
  });

  it("rejects zero, negatives and values the column cannot hold", () => {
    for (const bad of [0, -1, Number.NaN, 1_000_000]) {
      expect(() => assertCapacityTons(bad)).toThrow(RuleError);
    }
  });
});
