import { describe, expect, it } from "vitest";
import { formatBags, formatKg, formatTons } from "./delivery-format";

describe("delivery figures", () => {
  it("shows kilograms with up to two decimals", () => {
    expect(formatKg(2000)).toBe("2.000");
    expect(formatKg(1250.5)).toBe("1.250,5");
  });

  it("shows tons derived from kilograms with up to three decimals", () => {
    expect(formatTons(2000)).toBe("2");
    expect(formatTons(1250.5)).toBe("1,251");
    expect(formatTons(250)).toBe("0,25");
  });

  it("shows bags as whole numbers", () => {
    expect(formatBags(1200)).toBe("1.200");
  });
});
