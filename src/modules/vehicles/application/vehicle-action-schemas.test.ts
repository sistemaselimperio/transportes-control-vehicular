import { describe, expect, it } from "vitest";
import {
  assignDriverSchema,
  oilChangeSchema,
  renewDocumentSchema,
  sellSchema,
  transferOwnerSchema,
  updateKmSchema,
} from "./vehicle-action-schemas";

describe("form schemas", () => {
  it("parses km with thousands separators and blank optional fields", () => {
    expect(
      oilChangeSchema.parse({ date: "2026-10-01", km: "359.174", intervalMonths: "", notes: "  " }),
    ).toMatchObject({ km: 359174, intervalMonths: null, intervalKm: null, notes: null });
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
