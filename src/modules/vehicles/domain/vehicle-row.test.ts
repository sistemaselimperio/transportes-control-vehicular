import { describe, expect, it } from "vitest";
import { EMPTY_TECHNICAL_DATA } from "./technical-data";
import { buildVehicleRow, type VehicleRowInput } from "./vehicle-row";

const TODAY = "2026-10-17";

function input(overrides: Partial<VehicleRowInput> = {}): VehicleRowInput {
  return {
    vehicle: {
      id: 1,
      plate: "JVK-590",
      status: "ACTIVE",
      odometerWorking: true,
      currentKm: 359174,
      brandLine: "KENWORTH T800",
      municipality: "COTA-CUND",
      serviceType: "PUBLICO",
      notes: null,
      oilMode: "both",
    },
    classInfo: {
      name: "Tractocamión",
      oilIntervalKm: 20000,
      oilIntervalMonths: 2,
      documentsDefaultNotApplicable: false,
    },
    owner: { name: "TRANSPORTES EL IMPERIO", group: "IMPERIO" },
    driver: { name: "HECTOR MONTAÑO", phone: "3137546359" },
    policy: { kind: "TR", expiresOn: "2027-07-07", notApplicable: false },
    soat: { kind: null, expiresOn: "2027-05-12", notApplicable: false },
    tecno: { kind: null, expiresOn: "2027-05-08", notApplicable: false },
    tax: { kind: "EXEMPT", year: null },
    lastOil: {
      date: "2026-10-01",
      km: 359174,
      nextKm: 379174,
      nextDate: null,
      intervalKm: 20000,
      intervalMonths: null,
    },
    technical: EMPTY_TECHNICAL_DATA,
    today: TODAY,
    ...overrides,
  };
}

describe("buildVehicleRow", () => {
  it("builds display text and statuses for a healthy vehicle", () => {
    const row = buildVehicleRow(input());
    expect(row.plate).toBe("JVK-590");
    expect(row.className).toBe("Tractocamión");
    expect(row.ownerName).toBe("TRANSPORTES EL IMPERIO");
    expect(row.policy).toMatchObject({
      text: "TR 07/07/2027",
      status: "ok",
      date: "2027-07-07",
    });
    expect(row.soat).toMatchObject({ text: "12/05/2027", status: "ok" });
    expect(row.tax).toMatchObject({ text: "No paga", status: "not_applicable" });
    expect(row.driverName).toBe("HECTOR MONTAÑO");
    expect(row.lastOilDate).toBe("2026-10-01");
    expect(row.nextChange.text).toBe("379.174 km · 01/12/2026");
    expect(row.overall).toBe("ok");
  });

  it("marks expired and soon-to-expire documents", () => {
    const row = buildVehicleRow(
      input({
        soat: { kind: null, expiresOn: "2026-10-01", notApplicable: false },
        tecno: { kind: null, expiresOn: "2026-11-05", notApplicable: false },
      }),
    );
    expect(row.soat.status).toBe("expired");
    expect(row.tecno.status).toBe("warning");
    expect(row.overall).toBe("expired");
  });

  it("shows missing data as 'Sin dato' with a warning", () => {
    const row = buildVehicleRow(input({ policy: null, tax: null }));
    expect(row.policy).toMatchObject({ text: "Sin dato", status: "warning" });
    expect(row.tax).toMatchObject({ text: "Sin dato", status: "warning" });
  });

  it("treats a missing policy as not applicable for trailers", () => {
    const row = buildVehicleRow(
      input({
        policy: null,
        classInfo: {
          name: "Remolque",
          oilIntervalKm: null,
          oilIntervalMonths: null,
          documentsDefaultNotApplicable: true,
        },
        soat: { kind: null, expiresOn: null, notApplicable: true },
        tecno: { kind: null, expiresOn: null, notApplicable: true },
        lastOil: null,
        tax: { kind: "EXEMPT", year: null },
      }),
    );
    expect(row.policy).toMatchObject({ text: "No aplica", status: "not_applicable" });
    expect(row.nextChange.status).toBe("not_applicable");
    expect(row.overall).toBe("not_applicable");
  });

  it("flags unpaid tax from a previous year", () => {
    const row = buildVehicleRow(input({ tax: { kind: "PAID_YEAR", year: 2025 } }));
    expect(row.tax).toMatchObject({ text: "2025", status: "expired" });
  });

  it("uses the stored oil interval to compute the oil status", () => {
    const row = buildVehicleRow(
      input({
        vehicle: { ...input().vehicle, currentKm: 378900 },
        lastOil: {
          date: "2026-10-01",
          km: 359174,
          nextKm: 379174,
          nextDate: null,
          intervalKm: 20000,
          intervalMonths: null,
        },
      }),
    );
    expect(row.nextChange.status).toBe("warning"); // 274 km left
  });

  it("flags a missing oil record as warning for active vehicles", () => {
    const row = buildVehicleRow(input({ lastOil: null }));
    expect(row.nextChange).toMatchObject({ text: "Sin registro", status: "warning" });
  });

  it("shows idle and workshop vehicles as inactive with a label", () => {
    const idle = buildVehicleRow(input({ vehicle: { ...input().vehicle, status: "IDLE" } }));
    expect(idle.nextChange).toMatchObject({ text: "Quieta", status: "inactive" });
    const shop = buildVehicleRow(
      input({ vehicle: { ...input().vehicle, status: "IN_WORKSHOP" } }),
    );
    expect(shop.nextChange).toMatchObject({ text: "En taller", status: "inactive" });
  });

  it("greys out everything for sold vehicles", () => {
    const row = buildVehicleRow(
      input({
        vehicle: { ...input().vehicle, status: "SOLD" },
        soat: { kind: null, expiresOn: "2020-01-01", notApplicable: false },
      }),
    );
    expect(row.soat.status).toBe("inactive");
    expect(row.overall).toBe("inactive");
    expect(row.statusLabel).toBe("Vendido");
  });

  it("shows only the date when the odometer is broken", () => {
    const row = buildVehicleRow(
      input({
        vehicle: { ...input().vehicle, odometerWorking: false, currentKm: null, oilMode: "date" },
        classInfo: { ...input().classInfo, oilIntervalMonths: 2 },
        lastOil: {
          date: "2026-10-01",
          km: null,
          nextKm: null,
          nextDate: "2026-12-01",
          intervalKm: null,
          intervalMonths: 2,
        },
      }),
    );
    expect(row.nextChange.text).toBe("01/12/2026");
    expect(row.nextChange.status).toBe("ok");
    expect(row.odometerWorking).toBe(false);
  });
});
