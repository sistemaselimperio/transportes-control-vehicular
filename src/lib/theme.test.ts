import { describe, expect, it } from "vitest";
import { parseTheme } from "./theme";

describe("parseTheme", () => {
  it("keeps the known themes", () => {
    expect(parseTheme("yellow")).toBe("yellow");
    expect(parseTheme("sky")).toBe("sky");
  });

  it("falls back to the default yellow theme", () => {
    expect(parseTheme(undefined)).toBe("yellow");
    expect(parseTheme(null)).toBe("yellow");
    expect(parseTheme("")).toBe("yellow");
    expect(parseTheme("blue")).toBe("yellow");
    expect(parseTheme("SKY")).toBe("yellow");
  });
});
