import { describe, expect, it } from "vitest";
import { normalizePlate } from "./plate";

describe("normalizePlate", () => {
  it("uppercases and trims", () => {
    expect(normalizePlate("  abc-123 ")).toBe("ABC-123");
  });
  it("inserts the hyphen for 3 letters + 3 digits", () => {
    expect(normalizePlate("abc123")).toBe("ABC-123");
    expect(normalizePlate("ABC 123")).toBe("ABC-123");
  });
  it("keeps the hyphenated format as is", () => {
    expect(normalizePlate("XYZ-987")).toBe("XYZ-987");
  });
  it("leaves trailer plates without hyphen", () => {
    expect(normalizePlate("s88490")).toBe("S88490");
  });
  it("normalizes motorcycle plates (3 letters, 2 digits, 1 letter) without hyphen", () => {
    expect(normalizePlate("abc-12d")).toBe("ABC12D");
    expect(normalizePlate("abc 12d")).toBe("ABC12D");
  });
  it("throws on empty input", () => {
    expect(() => normalizePlate("   ")).toThrow();
  });
});
