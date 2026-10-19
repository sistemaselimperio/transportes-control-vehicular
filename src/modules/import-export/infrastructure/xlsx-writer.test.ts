import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildVehicleRow } from "@/modules/vehicles/domain/vehicle-row";
import { EXPORT_HEADERS, buildVehiclesWorkbook } from "./xlsx-writer";

const row = buildVehicleRow({
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
  today: "2026-10-17",
});

describe("buildVehiclesWorkbook", () => {
  it("writes the Excel headers and one row per vehicle", async () => {
    const data = await buildVehiclesWorkbook([row]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];

    const headers = (ws.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual([...EXPORT_HEADERS]);
    expect(EXPORT_HEADERS[0]).toBe("Clase");
    expect(EXPORT_HEADERS[1]).toBe("Placa");

    const values = (ws.getRow(2).values as unknown[]).slice(1);
    expect(values[0]).toBe("Tractocamión KENWORTH T800");
    expect(values[1]).toBe("JVK-590");
    expect(values[2]).toBe("TRANSPORTES EL IMPERIO");
    expect(values[3]).toBe("TR 07/07/2027");
    expect(values[8]).toBe("3137546359");
    expect(values[10]).toBe(359174);
    expect(values[14]).toBe("Activo");
    expect(ws.rowCount).toBe(2);
  });
});
