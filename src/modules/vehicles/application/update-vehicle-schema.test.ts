import { describe, expect, it } from "vitest";
import { updateVehicleSchema } from "./update-vehicle-schema";

describe("updateVehicleSchema", () => {
  it("keeps absent keys out and turns blank text into null", () => {
    expect(updateVehicleSchema.parse({ brandLine: "  Hino ", notes: "  ", towingPlate: null })).toEqual({
      brandLine: "Hino",
      notes: null,
      towingPlate: null,
    });
  });

  it("parses every editable field", () => {
    expect(
      updateVehicleSchema.parse({
        plate: "XYZ987",
        classId: 2,
        municipality: "TUNJA (BOYACÁ)",
        serviceType: "PUBLICO",
        oilMode: "date",
        towingPlate: "TRC500",
      }),
    ).toEqual({
      plate: "XYZ987",
      classId: 2,
      municipality: "TUNJA (BOYACÁ)",
      serviceType: "PUBLICO",
      oilMode: "date",
      towingPlate: "TRC500",
    });
  });

  it("clears the municipality with null", () => {
    expect(updateVehicleSchema.parse({ municipality: null })).toEqual({ municipality: null });
  });

  it("rejects an empty body, unknown keys and bad values", () => {
    expect(updateVehicleSchema.safeParse({}).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ status: "SOLD" }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ classId: "2" }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ plate: "  " }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ municipality: "Tunja" }).success).toBe(false);
  });
});
