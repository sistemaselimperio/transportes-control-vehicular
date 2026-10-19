import ExcelJS from "exceljs";
import type { CellValue } from "../domain/cell-parsers";
import type { RawRow, RawSheet } from "../domain/types";

function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Flattens exceljs cell values (formulas, rich text, links) to plain values. */
function plainValue(value: ExcelJS.CellValue): CellValue {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "VERDADERO" : "FALSO";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((p) => p.text).join("");
    if ("formula" in value || "sharedFormula" in value) {
      const result = (value as { result?: ExcelJS.CellValue }).result;
      return result === undefined ? null : plainValue(result);
    }
    if ("text" in value) return String(value.text);
    if ("error" in value) return null;
  }
  return null;
}

export async function readWorkbook(
  data: ArrayBuffer | Uint8Array,
): Promise<RawSheet[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  return workbook.worksheets.map((worksheet) => {
    const rows: RawRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: Record<string, CellValue> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const value = plainValue(cell.value);
        if (value !== null) cells[columnLetter(col)] = value;
      });
      rows.push({ rowNumber, cells });
    });
    return { name: worksheet.name, rows };
  });
}
