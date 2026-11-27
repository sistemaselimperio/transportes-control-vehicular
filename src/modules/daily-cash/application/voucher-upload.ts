import { parseVoucherSheet, type Cell, type ParsedVoucher, type SkippedVoucher } from "../domain/voucher-import";

/** An uploaded workbook already read into grids of cells, one per sheet. */
export interface UploadedFile {
  name: string;
  sheets: ReadonlyArray<ReadonlyArray<ReadonlyArray<Cell>>>;
}

export type UploadedVoucher = ParsedVoucher & { file: string };

export interface ParsedUploads {
  rows: UploadedVoucher[];
  skipped: Array<SkippedVoucher & { file: string }>;
  /** Files with no voucher sheet at all. */
  fileErrors: Array<{ file: string; error: string }>;
}

/** The vouchers of every uploaded file. A file that is not a voucher export is reported without stopping the others. */
export function parseUploads(files: readonly UploadedFile[]): ParsedUploads {
  const result: ParsedUploads = { rows: [], skipped: [], fileErrors: [] };
  for (const file of files) {
    const parsed = file.sheets.map((grid) => parseVoucherSheet(grid));
    const valid = parsed.filter((p) => p.error === null);
    if (valid.length === 0) {
      result.fileErrors.push({ file: file.name, error: parsed[0]?.error ?? "El archivo no tiene hojas." });
      continue;
    }
    for (const sheet of valid) {
      result.rows.push(...sheet.rows.map((row) => ({ ...row, file: file.name })));
      result.skipped.push(...sheet.skipped.map((s) => ({ ...s, file: file.name })));
    }
  }
  return result;
}
