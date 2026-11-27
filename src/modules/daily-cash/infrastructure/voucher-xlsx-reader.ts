import ExcelJS from "exceljs";
import type { Cell } from "../domain/voucher-import";

/** Flattens exceljs cell values (formulas, rich text, links) to plain cells. */
function plainCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((p) => p.text).join("");
    if ("formula" in value || "sharedFormula" in value) {
      const result = (value as { result?: ExcelJS.CellValue }).result;
      return result === undefined ? null : plainCell(result);
    }
    if ("text" in value) return String(value.text);
  }
  return null;
}

/**
 * Every sheet of a workbook as a grid of cells. The grid keeps the sheet's rows and columns in place
 * (row `i` of the grid is row `i + 1` of the sheet), so a row number shown to the user is the one in Excel.
 */
export async function readVoucherWorkbook(data: ArrayBuffer): Promise<Cell[][][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(data) as unknown as ExcelJS.Buffer);
  return workbook.worksheets.map((worksheet) => {
    const grid: Cell[][] = [];
    for (let r = 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const cells: Cell[] = [];
      for (let c = 1; c <= worksheet.columnCount; c++) cells.push(plainCell(row.getCell(c).value));
      grid.push(cells);
    }
    return grid;
  });
}
