import { describe, expect, it } from "vitest";
import { INTERNAL_CLASS_NAMES, isInternalClass } from "./internal-classes";

describe("isInternalClass", () => {
  it.each(INTERNAL_CLASS_NAMES)("treats %s as internal", (name) => {
    expect(isInternalClass(name)).toBe(true);
  });

  it("ignores case, accents and surrounding spaces", () => {
    expect(isInternalClass("  MOTOCICLETA ")).toBe(true);
    expect(isInternalClass("montacargas")).toBe(true);
  });

  it.each(["Camión", "Tractocamión", "Turbo", "Camioneta", "Automóvil", "Campero", "Tractor"])(
    "keeps %s selectable",
    (name) => {
      expect(isInternalClass(name)).toBe(false);
    },
  );
});
