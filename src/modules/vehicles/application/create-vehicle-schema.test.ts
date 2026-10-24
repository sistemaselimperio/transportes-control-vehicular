import { describe, expect, it } from "vitest";
import { createVehicleSchema } from "./create-vehicle-schema";

describe("createVehicleSchema", () => {
  it("accepts only municipalities from the DIVIPOLA catalog", () => {
    expect(createVehicleSchema.parse({ plate: "ABC123", classId: 1, municipality: "Bogotá, D.C." }).municipality).toBe(
      "Bogotá, D.C.",
    );
    expect(createVehicleSchema.safeParse({ plate: "ABC123", classId: 1, municipality: "Bogota" }).success).toBe(false);
  });

  it("fills defaults from a minimal body", () => {
    const parsed = createVehicleSchema.parse({ plate: "ABC123", classId: 1 });
    expect(parsed).toMatchObject({
      plate: "ABC123",
      classId: 1,
      brandLine: null,
      serviceType: "PARTICULAR",
      status: "ACTIVE",
      oilMode: "both",
      odometerWorking: true,
      currentKm: null,
      towingPlate: null,
      owner: null,
      driver: null,
      documents: [],
      tax: null,
      oilChange: null,
    });
  });

  it("capitalizes the first letter of each word of a new owner and driver", () => {
    const parsed = createVehicleSchema.parse({
      plate: "ABC123",
      classId: 1,
      owner: { kind: "new", name: "  PÉREZ   gómez juan ", date: "2026-10-01" },
      driver: { kind: "new", name: "maría de la rosa", date: "2026-10-01" },
    });
    expect(parsed.owner?.target).toMatchObject({ name: "Pérez Gómez Juan" });
    expect(parsed.driver?.target).toMatchObject({ name: "María de la Rosa" });
  });

  it("parses the full body with owner, driver, documents, tax and oil change", () => {
    const parsed = createVehicleSchema.parse({
      plate: "ABC123",
      classId: 1,
      brandLine: "  Chevrolet NHR ",
      owner: { kind: "new", name: "Juan", date: "2026-10-01" },
      driver: { kind: "existing", id: 3, date: "2026-10-01" },
      documents: [{ type: "POLICY", policyKind: "TR", expiresOn: "2027-01-01" }],
      tax: { kind: "PAID_YEAR", year: 2026 },
      oilChange: { date: "2026-10-01", km: 1000, intervalKm: 5000 },
    });
    expect(parsed.brandLine).toBe("Chevrolet NHR");
    expect(parsed.owner).toEqual({
      target: { kind: "new", name: "Juan", documentNumber: null },
      date: "2026-10-01",
    });
    expect(parsed.driver).toEqual({ target: { kind: "existing", id: 3 }, date: "2026-10-01" });
    expect(parsed.documents[0]).toEqual({
      type: "POLICY",
      policyKind: "TR",
      expiresOn: "2027-01-01",
      notApplicable: false,
    });
    expect(parsed.oilChange).toEqual({
      date: "2026-10-01",
      km: 1000,
      notes: null,
      interval: { months: null, km: 5000 },
    });
  });

  it("rejects invalid dates, SOLD status and missing plate", () => {
    expect(createVehicleSchema.safeParse({ classId: 1 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ plate: "A", classId: 1, status: "SOLD" }).success).toBe(false);
    expect(
      createVehicleSchema.safeParse({
        plate: "A",
        classId: 1,
        owner: { kind: "imperio", date: "2026-13-45" },
      }).success,
    ).toBe(false);
  });
});
