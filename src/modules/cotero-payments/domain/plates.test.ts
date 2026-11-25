import { describe, expect, it } from "vitest";
import { formatVehiclePlate, normalizeVehiclePlate } from "./plates";

describe("normalizeVehiclePlate", () => {
  it("is uppercase without spaces or hyphens", () => {
    expect(normalizeVehiclePlate("abc-123")).toBe("ABC123");
    expect(normalizeVehiclePlate(" ABC 123 ")).toBe("ABC123");
    expect(normalizeVehiclePlate("R 21396")).toBe("R21396");
    expect(normalizeVehiclePlate("r-21396")).toBe("R21396");
  });

  it("is empty for blank text", () => {
    expect(normalizeVehiclePlate("")).toBe("");
    expect(normalizeVehiclePlate(" - ")).toBe("");
  });
});

describe("formatVehiclePlate", () => {
  it("shows cars with a hyphen between letters and digits", () => {
    expect(formatVehiclePlate("ABC123")).toBe("ABC-123");
  });

  it("shows trailers with the hyphen after the letter", () => {
    expect(formatVehiclePlate("R21396")).toBe("R-21396");
  });

  it("shows motorcycles too and leaves anything else as stored", () => {
    expect(formatVehiclePlate("ABC12D")).toBe("ABC-12D");
    expect(formatVehiclePlate("XYZ")).toBe("XYZ");
    expect(formatVehiclePlate("")).toBe("");
  });
});
