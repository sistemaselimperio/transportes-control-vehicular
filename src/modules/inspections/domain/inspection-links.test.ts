import { describe, expect, it } from "vitest";
import { applySelectedDriver, findSelectedDriver, maskNationalId, normalizeNationalIdKey, normalizePlateKey, resolveInspectionLinks } from "./inspection-links";

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

describe("selected driver", () => {
  const registered = [
    { id: 1, name: "Juan Pérez", nationalId: "111" },
    { id: 2, name: "Ana Gómez", nationalId: null },
  ];

  it("finds the registered driver by id", () => {
    expect(findSelectedDriver(2, registered)).toEqual(registered[1]);
  });

  it("returns null for no selection or an unknown id", () => {
    expect(findSelectedDriver(null, registered)).toBeNull();
    expect(findSelectedDriver(undefined, registered)).toBeNull();
    expect(findSelectedDriver(99, registered)).toBeNull();
  });

  it("uses the selected driver over the typed national id", () => {
    const links = resolveInspectionLinks(
      { plate: "x", trailerPlate: null, driverNationalId: "111", selectedDriverId: 2 },
      [],
      registered,
    );
    expect(links.driverId).toBe(2);
  });

  it("falls back to the national id when the selected id does not exist", () => {
    const links = resolveInspectionLinks(
      { plate: "x", trailerPlate: null, driverNationalId: "111", selectedDriverId: 99 },
      [],
      registered,
    );
    expect(links.driverId).toBe(1);
  });
});

describe("maskNationalId", () => {
  it("keeps only the last four digits", () => {
    expect(maskNationalId("1.234.567-8")).toBe("••••5678");
    expect(maskNationalId("80123456")).toBe("••••3456");
  });

  it("hides a short id entirely and returns null when there is none", () => {
    expect(maskNationalId("123")).toBe("••••");
    expect(maskNationalId(null)).toBeNull();
    expect(maskNationalId("  ")).toBeNull();
    expect(maskNationalId("sin cedula")).toBeNull();
  });
});

describe("applySelectedDriver", () => {
  const registered = [
    { id: 1, name: "Juan Pérez", nationalId: "111" },
    { id: 2, name: "Ana Gómez", nationalId: null },
  ];
  const typed = { driverName: "typed name", driverNationalId: "999", selectedDriverId: null as number | null };

  it("uses the registered name and national id, ignoring the client's", () => {
    expect(applySelectedDriver({ ...typed, selectedDriverId: 1 }, registered)).toEqual({
      ok: true,
      driverName: "Juan Pérez",
      driverNationalId: "111",
    });
  });

  it("uses the typed national id when the driver has none registered", () => {
    expect(applySelectedDriver({ ...typed, selectedDriverId: 2 }, registered)).toEqual({
      ok: true,
      driverName: "Ana Gómez",
      driverNationalId: "999",
    });
  });

  it("requires the typed national id when the driver has none registered", () => {
    expect(applySelectedDriver({ ...typed, driverNationalId: "", selectedDriverId: 2 }, registered)).toEqual({ ok: false });
  });

  it("keeps the typed values without a selection and requires the id", () => {
    expect(applySelectedDriver(typed, registered)).toEqual({ ok: true, driverName: "typed name", driverNationalId: "999" });
    expect(applySelectedDriver({ ...typed, driverNationalId: "" }, registered)).toEqual({ ok: false });
  });

  it("treats an unknown selected id as no selection", () => {
    expect(applySelectedDriver({ ...typed, selectedDriverId: 99 }, registered)).toEqual({
      ok: true,
      driverName: "typed name",
      driverNationalId: "999",
    });
  });
});
