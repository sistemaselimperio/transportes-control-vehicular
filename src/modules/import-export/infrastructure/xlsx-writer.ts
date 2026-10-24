import ExcelJS from "exceljs";
import type { VehicleGridRow } from "@/modules/vehicles/domain/vehicle-row";

/** Same headers as the grid (and the legacy Excel). */
export const EXPORT_HEADERS = [
  "Clase",
  "Placa",
  "Propietario",
  "Póliza",
  "Municipio",
  "Servicio",
  "Impuesto",
  "Conductor",
  "Celular",
  "F. cambio",
  "Kilometraje",
  "Próx. cambio",
  "SOAT",
  "Tecno",
  "Estado",
  "F. matrícula",
  "Modelo",
  "N.º motor",
  "N.º chasis",
  "N.º serie",
  "Carrocería",
  "Combustible",
  "Capacidad",
  "Cilindraje",
  "Peso bruto (kg)",
  "Color",
] as const;

const isoToDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00.000Z`) : null;

export async function buildVehiclesWorkbook(
  rows: readonly VehicleGridRow[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Vehículos", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });
  ws.addRow([...EXPORT_HEADERS]);
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow([
      [r.className, r.brandLine].filter(Boolean).join(" "),
      r.plate,
      r.ownerName ?? "",
      r.policy.text,
      r.municipality ?? "",
      r.serviceLabel,
      r.tax.text,
      r.driverName ?? "",
      r.driverPhone ?? "",
      isoToDate(r.lastOilDate),
      r.km ?? (r.odometerWorking ? null : "No sirve"),
      r.nextChange.text,
      r.soat.date ? isoToDate(r.soat.date) : r.soat.text,
      r.tecno.date ? isoToDate(r.tecno.date) : r.tecno.text,
      r.statusLabel,
      isoToDate(r.technical.registrationDate),
      r.technical.modelYear,
      r.technical.engineNumber ?? "",
      r.technical.chassisNumber ?? "",
      r.technical.serialNumber ?? "",
      r.technical.bodyType ?? "",
      r.technical.fuelType ?? "",
      r.technical.capacity ?? "",
      r.technical.engineDisplacement,
      r.technical.grossWeightKg,
      r.technical.color ?? "",
    ]);
  }

  // Dates and widths.
  for (const col of [10, 13, 14, 16]) ws.getColumn(col).numFmt = "dd/mm/yyyy";
  const widths = [34, 11, 28, 15, 18, 11, 16, 26, 13, 12, 12, 22, 12, 12, 11, 13, 9, 14, 14, 12, 14, 13, 12, 11, 15, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_HEADERS.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
