/** Excel files of the cotero payments, written with exceljs: the settlement sheet and the receipts list. */
import ExcelJS from "exceljs";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { pesosInWords } from "../domain/number-words";
import { formatVehiclePlate } from "../domain/plates";
import { totalsOfReceipts, type ReceiptRow } from "../domain/receipt-rules";
import type { SettlementRow } from "../domain/settlement-rows";
import { PAYMENT_METHOD_LABELS, RECEIPT_STATUS_LABELS } from "../domain/settlement-rules";
import { settlementSheetLines } from "../domain/sheet-format";

const PESOS = '"$"#,##0';
const TONS = "#,##0.000";
const THIN = { style: "thin", color: { argb: "FF444444" } } as const;
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN } as const;

async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** A cédula with dot grouping: "1.056.507.092". */
const formatDocument = (document: string) => document.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * The settlement receipt a cotero gets: "LIQUIDACIÓN DE CARGUE Y DESCARGUE" with one line per receipt
 * (what each receipt says is what is paid), the total, how it is paid and the amount in words.
 */
export async function buildSettlementWorkbook(settlement: SettlementRow, receipts: readonly ReceiptRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Liquidación ${settlement.number}`, { pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = [{ width: 34 }, { width: 22 }, { width: 14 }, { width: 18 }, { width: 20 }];

  sheet.mergeCells("A1:E1");
  const title = sheet.getCell("A1");
  title.value = "LIQUIDACIÓN DE CARGUE Y DESCARGUE";
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  const header = (row: number, label: string, value: string) => {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.mergeCells(`B${row}:E${row}`);
    sheet.getCell(`B${row}`).value = value;
  };
  header(3, "Señores:", settlement.coteroName);
  header(4, "Fecha:", formatDisplayDate(settlement.date));
  header(5, "NIT / C.C.:", settlement.coteroDocument ? formatDocument(settlement.coteroDocument) : "");

  const headRow = 7;
  ["DESCRIPCIÓN", "FECHA", "TONELADAS", "VALOR UNITARIO", "VALOR TOTAL"].forEach((label, i) => {
    const cell = sheet.getCell(headRow, i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
    cell.border = BOX;
  });

  const lines = settlementSheetLines(receipts);
  const first = headRow + 1;
  lines.forEach((line, i) => {
    const r = first + i;
    sheet.getCell(r, 2).value = line.day;
    sheet.getCell(r, 3).value = line.tons;
    sheet.getCell(r, 3).numFmt = TONS;
    sheet.getCell(r, 4).value = line.unitPrice;
    sheet.getCell(r, 4).numFmt = PESOS;
    sheet.getCell(r, 5).value = line.total;
    sheet.getCell(r, 5).numFmt = PESOS;
    for (let c = 1; c <= 5; c++) sheet.getCell(r, c).border = BOX;
  });
  const last = first + Math.max(lines.length, 1) - 1;
  if (last > first) sheet.mergeCells(`A${first}:A${last}`);
  const description = sheet.getCell(`A${first}`);
  description.value = "SERVICIO CARGUE Y DESCARGUE";
  description.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let r = first; r <= last; r++) sheet.getCell(r, 1).border = BOX;

  const totalRow = last + 1;
  const tons = Math.round(lines.reduce((sum, l) => sum + l.tons, 0) * 1000) / 1000;
  const total = lines.reduce((sum, l) => sum + l.total, 0);
  sheet.getCell(totalRow, 1).value = "TOTAL";
  sheet.getCell(totalRow, 3).value = tons;
  sheet.getCell(totalRow, 3).numFmt = TONS;
  sheet.getCell(totalRow, 5).value = total;
  sheet.getCell(totalRow, 5).numFmt = PESOS;
  for (let c = 1; c <= 5; c++) {
    const cell = sheet.getCell(totalRow, c);
    cell.font = { bold: true };
    cell.border = BOX;
  }

  const pay = totalRow + 2;
  const method = settlement.paymentMethod ? PAYMENT_METHOD_LABELS[settlement.paymentMethod].toUpperCase() : "";
  header(pay, "PAGO:", [method, settlement.paymentAccount].filter(Boolean).join(" · "));
  sheet.getCell(`A${pay + 1}`).value = "NETO A PAGAR";
  sheet.getCell(`A${pay + 1}`).font = { bold: true };
  sheet.mergeCells(`B${pay + 1}:E${pay + 1}`);
  sheet.getCell(`B${pay + 1}`).value = total;
  sheet.getCell(`B${pay + 1}`).numFmt = PESOS;
  sheet.getCell(`B${pay + 1}`).font = { bold: true };
  sheet.getCell(`B${pay + 1}`).alignment = { horizontal: "left" };
  sheet.getCell(`A${pay + 2}`).value = "SON:";
  sheet.getCell(`A${pay + 2}`).font = { bold: true };
  sheet.mergeCells(`B${pay + 2}:E${pay + 2}`);
  sheet.getCell(`B${pay + 2}`).value = pesosInWords(total);
  sheet.getCell(`B${pay + 2}`).alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(pay + 2).height = 32;

  return toBuffer(workbook);
}

/** The receipts of a filtered list, one row each, with a totals row. */
export async function buildReceiptsWorkbook(rows: readonly ReceiptRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Recibos");
  sheet.columns = [
    { header: "N.º recibo", key: "number", width: 12 },
    { header: "Fecha", key: "date", width: 12 },
    { header: "Destino", key: "destination", width: 28 },
    { header: "Remisiones", key: "remissions", width: 22 },
    { header: "Toneladas", key: "tons", width: 12 },
    { header: "Placa", key: "plate", width: 11 },
    { header: "Trailer", key: "trailer", width: 11 },
    { header: "Cuadrilla", key: "crew", width: 10 },
    { header: "Cotero", key: "cotero", width: 26 },
    { header: "Cédula", key: "document", width: 14 },
    { header: "Conductor", key: "driver", width: 24 },
    { header: "Liquidación", key: "amount", width: 15 },
    { header: "Valor esperado", key: "expected", width: 15 },
    { header: "Revisar valor", key: "mismatch", width: 13 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Liquidación n.º", key: "settlement", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const r of rows) {
    sheet.addRow({
      number: r.receiptNumber,
      date: formatDisplayDate(r.date),
      destination: r.destination,
      remissions: r.remissions.join(" "),
      tons: r.tons,
      plate: formatVehiclePlate(r.vehiclePlate),
      trailer: r.trailerPlate ? formatVehiclePlate(r.trailerPlate) : "",
      crew: r.crew ?? "",
      cotero: r.coteroName,
      document: r.coteroDocument ?? "",
      driver: r.driverName,
      amount: r.amount,
      expected: r.expectedAmount ?? "",
      mismatch: r.amountMismatch ? "Sí" : "",
      status: RECEIPT_STATUS_LABELS[r.status],
      settlement: r.settlementNumber ?? "",
    });
  }
  const totals = totalsOfReceipts(rows);
  const totalRow = sheet.addRow({ number: "TOTAL", destination: `${totals.count} recibos`, tons: totals.tons, amount: totals.amount });
  totalRow.font = { bold: true };

  sheet.getColumn("tons").numFmt = TONS;
  sheet.getColumn("amount").numFmt = PESOS;
  sheet.getColumn("expected").numFmt = PESOS;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };

  return toBuffer(workbook);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
