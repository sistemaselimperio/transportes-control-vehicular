import { describe, expect, it } from "vitest";
import {
  assignDriverSchema,
  oilChangeSchema,
  renewDocumentSchema,
  sellSchema,
  technicalDataSchema,
  transferOwnerSchema,
  updateKmSchema,
} from "./vehicle-action-schemas";

describe("form schemas", () => {
  it("parses km with thousands separators and blank optional fields", () => {
    expect(
      oilChangeSchema.parse({ date: "2026-10-01", km: "359.174", intervalMonths: "", notes: "  " }),
    ).toMatchObject({ km: 359174, intervalMonths: null, intervalKm: null, notes: null });
  });

  it("reads the price and the supplies of an oil change", () => {
    const parsed = oilChangeSchema.parse({
      date: "2026-10-01",
      km: "1000",
      price: "350.000",
      items: JSON.stringify([{ quantity: "48", detail: "CUARTOS DELO 15W40" }]),
    });
    expect(parsed.price).toBe(350000);
    expect(parsed.items).toEqual([{ quantity: 48, detail: "CUARTOS DELO 15W40" }]);
  });

  it("leaves price and supplies empty when they are not sent", () => {
    expect(oilChangeSchema.parse({ date: "2026-10-01", km: "1" })).toMatchObject({ price: null, items: [] });
  });

  it("rejects non numeric km and invalid dates", () => {
    expect(() => updateKmSchema.parse({ km: "12abc" })).toThrow(/entero/);
    expect(() => oilChangeSchema.parse({ date: "2026-13-45", km: "1" })).toThrow(/fecha/);
  });

  it("maps checkboxes", () => {
    expect(updateKmSchema.parse({ km: "", odometerBroken: "on" }).odometerBroken).toBe(true);
    expect(updateKmSchema.parse({ km: "" }).odometerBroken).toBe(false);
  });

  it("reads the document form", () => {
    expect(
      renewDocumentSchema.parse({ type: "POLICY", policyKind: "RC", expiresOn: "2027-01-01" }),
    ).toMatchObject({ policyKind: "RC", notApplicable: false });
    expect(renewDocumentSchema.parse({ type: "SOAT", policyKind: "", notApplicable: "on" })).toMatchObject({
      policyKind: null,
      expiresOn: null,
      notApplicable: true,
    });
  });

  it("requires a driver choice or a name", () => {
    const date = "2026-10-17";
    expect(() => assignDriverSchema.parse({ mode: "existing", driverId: "", date })).toThrow(/conductor/);
    expect(() => assignDriverSchema.parse({ mode: "new", name: " ", date })).toThrow(/nombre/);
    expect(assignDriverSchema.parse({ mode: "existing", driverId: "4", date }).driverId).toBe(4);
  });

  it("validates the owner choice", () => {
    const date = "2026-10-17";
    expect(() => transferOwnerSchema.parse({ owner: "", date })).toThrow();
    expect(() => transferOwnerSchema.parse({ owner: "NEW", date })).toThrow(/nombre/);
    expect(() => transferOwnerSchema.parse({ owner: "abc", date })).toThrow();
    expect(transferOwnerSchema.parse({ owner: "IMPERIO", date }).owner).toBe("IMPERIO");
  });

  it("parses the sale price", () => {
    expect(sellSchema.parse({ date: "2026-10-17", price: "25.000.000" }).price).toBe(25_000_000);
  });
});

describe("technicalDataSchema", () => {
  it("parses the datos generales sheet", () => {
    expect(
      technicalDataSchema.parse({
        registrationDate: "2020-09-28",
        modelYear: "2021",
        engineNumber: " 80236366 ",
        chassisNumber: "0727121",
        serialNumber: "727121",
        bodyType: "SRS",
        fuelType: "DIESEL",
        capacity: "",
        engineDisplacement: "14.900",
        grossWeightKg: "52.000",
        color: "BLANCO",
      }),
    ).toEqual({
      registrationDate: "2020-09-28",
      modelYear: 2021,
      engineNumber: "80236366",
      chassisNumber: "0727121",
      serialNumber: "727121",
      bodyType: "SRS",
      fuelType: "DIESEL",
      capacity: null,
      engineDisplacement: 14900,
      grossWeightKg: 52000,
      color: "BLANCO",
    });
  });

  it("turns an empty form into all nulls", () => {
    expect(Object.values(technicalDataSchema.parse({})).every((v) => v === null)).toBe(true);
  });

  it("rejects an invalid date or non numeric values", () => {
    expect(() => technicalDataSchema.parse({ registrationDate: "2020-13-45" })).toThrow(/fecha/);
    expect(() => technicalDataSchema.parse({ engineDisplacement: "14x" })).toThrow(/entero/);
  });
});
