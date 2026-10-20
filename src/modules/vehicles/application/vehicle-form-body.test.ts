import { describe, expect, it } from "vitest";
import { createVehicleSchema } from "./create-vehicle-schema";
import { updateVehicleSchema } from "./update-vehicle-schema";
import { createBodyFromForm, editBodyFromForm } from "./vehicle-form-body";

describe("createBodyFromForm", () => {
  it("maps a minimal form to a valid body", () => {
    const body = createBodyFromForm({ plate: "ABC123", classId: "1", serviceType: "PARTICULAR" });
    expect(body).toMatchObject({
      plate: "ABC123",
      classId: 1,
      currentKm: null,
      odometerWorking: true,
      owner: null,
      driver: null,
      documents: [],
      tax: null,
      oilChange: null,
    });
    expect(createVehicleSchema.safeParse(body).success).toBe(true);
  });

  it("maps owner, driver, documents, tax and oil change", () => {
    const body = createBodyFromForm({
      plate: "ABC123",
      classId: "1",
      currentKm: "359.174",
      odometerBroken: "on",
      ownerChoice: "NEW",
      ownerName: "Juan",
      ownerDocument: "",
      ownerDate: "2026-10-01",
      driverChoice: "7",
      driverDate: "2026-10-02",
      soatExpiresOn: "2027-01-01",
      tecnoNotApplicable: "on",
      policyKind: "TR",
      policyExpiresOn: "2027-02-01",
      taxKind: "PAID_YEAR",
      taxYear: "2026",
      oilDate: "2026-10-01",
      oilKm: "",
    });
    expect(body).toMatchObject({
      currentKm: 359174,
      odometerWorking: false,
      owner: { kind: "new", name: "Juan", documentNumber: null, date: "2026-10-01" },
      driver: { kind: "existing", id: 7, date: "2026-10-02" },
      documents: [
        { type: "SOAT", expiresOn: "2027-01-01" },
        { type: "TECNO", notApplicable: true },
        { type: "POLICY", policyKind: "TR", expiresOn: "2027-02-01" },
      ],
      tax: { kind: "PAID_YEAR", year: 2026 },
      oilChange: { date: "2026-10-01", km: null },
    });
    expect(createVehicleSchema.safeParse(body).success).toBe(true);
  });

  it("maps the Imperio owner and a new driver", () => {
    const body = createBodyFromForm({
      plate: "A",
      classId: "1",
      ownerChoice: "IMPERIO",
      ownerDate: "2026-10-01",
      driverChoice: "NEW",
      driverName: "Pedro",
      driverPhone: "300",
      driverDate: "2026-10-01",
    });
    expect(body.owner).toEqual({ kind: "imperio", date: "2026-10-01" });
    expect(body.driver).toEqual({
      kind: "new",
      name: "Pedro",
      nationalId: null,
      phone: "300",
      date: "2026-10-01",
    });
  });
});

describe("editBodyFromForm", () => {
  it("maps the editable fields, a blank towing plate unlinks it", () => {
    const body = editBodyFromForm({
      plate: "XYZ987",
      classId: "2",
      brandLine: "Hino",
      municipality: "",
      notes: "",
      serviceType: "PUBLICO",
      oilMode: "date",
      towingPlate: "",
    });
    expect(body).toEqual({
      plate: "XYZ987",
      classId: 2,
      brandLine: "Hino",
      municipality: null,
      notes: null,
      serviceType: "PUBLICO",
      oilMode: "date",
      towingPlate: null,
    });
    expect(updateVehicleSchema.safeParse(body).success).toBe(true);
  });
});
