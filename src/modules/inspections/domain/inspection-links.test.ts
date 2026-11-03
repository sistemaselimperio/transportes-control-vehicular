import { describe, expect, it } from "vitest";
import { normalizeNationalIdKey, normalizePlateKey, resolveInspectionLinks } from "./inspection-links";

describe("normalizePlateKey", () => {
  it("uppercases and strips spaces, hyphens and dots", () => {
    expect(normalizePlateKey("abc-123 ")).toBe("ABC123");
    expect(normalizePlateKey(" a b.c 1-2 3")).toBe("ABC123");
  });

  it("makes the registered and the typed spelling of a plate equal", () => {
    expect(normalizePlateKey("ABC-123")).toBe(normalizePlateKey("abc123"));
    expect(normalizePlateKey("S88490")).toBe(normalizePlateKey("s 88490"));
  });

  it("returns an empty key for blank input", () => {
    expect(normalizePlateKey("  - . ")).toBe("");
  });
});

describe("normalizeNationalIdKey", () => {
  it("keeps only the digits", () => {
    expect(normalizeNationalIdKey("1.234.567-8")).toBe("12345678");
    expect(normalizeNationalIdKey(" 80 123 456 ")).toBe("80123456");
  });

  it("returns an empty key when there are no digits", () => {
    expect(normalizeNationalIdKey("N/A")).toBe("");
  });
});

describe("resolveInspectionLinks", () => {
  const vehicles = [
    { id: 1, plate: "ABC-123" },
    { id: 2, plate: "S88490" },
  ];
  const drivers = [
    { id: 10, nationalId: "1.234.567" },
    { id: 11, nationalId: null },
  ];

  it("links the tractor, the trailer and the driver by their normalized keys", () => {
    expect(
      resolveInspectionLinks({ plate: "abc123", trailerPlate: "s-88490", driverNationalId: "1234567" }, vehicles, drivers),
    ).toEqual({ vehicleId: 1, trailerVehicleId: 2, driverId: 10 });
  });

  it("leaves a link empty when nothing matches", () => {
    expect(
      resolveInspectionLinks({ plate: "ZZZ999", trailerPlate: null, driverNationalId: "999" }, vehicles, drivers),
    ).toEqual({ vehicleId: null, trailerVehicleId: null, driverId: null });
  });

  it("never matches a blank key against a driver without national id", () => {
    expect(
      resolveInspectionLinks({ plate: "ABC123", trailerPlate: null, driverNationalId: "sin cedula" }, vehicles, drivers)
        .driverId,
    ).toBeNull();
  });

  it("does not guess between two records with the same key", () => {
    const twins = [
      { id: 20, nationalId: "555" },
      { id: 21, nationalId: "5.55" },
    ];
    expect(resolveInspectionLinks({ plate: "x", trailerPlate: null, driverNationalId: "555" }, [], twins).driverId).toBeNull();
    const plateTwins = [
      { id: 30, plate: "ABC-123" },
      { id: 31, plate: "ABC123" },
    ];
    expect(
      resolveInspectionLinks({ plate: "abc123", trailerPlate: null, driverNationalId: "1" }, plateTwins, []).vehicleId,
    ).toBeNull();
  });
});
