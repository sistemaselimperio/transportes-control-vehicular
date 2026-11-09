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
  it("inserts the hyphen after the letter of trailer plates (1 letter + 5 digits)", () => {
    expect(normalizePlate("s88490")).toBe("S-88490");
    expect(normalizePlate("R 44914")).toBe("R-44914");
    expect(normalizePlate("S-88490")).toBe("S-88490");
  });
  it("normalizes motorcycle plates (3 letters, 2 digits, 1 letter) with a hyphen", () => {
    expect(normalizePlate("abc12d")).toBe("ABC-12D");
    expect(normalizePlate("abc 12d")).toBe("ABC-12D");
    expect(normalizePlate("EMS-44E")).toBe("EMS-44E");
  });
  it("throws on empty input", () => {
    expect(() => normalizePlate("   ")).toThrow();
  });
});
