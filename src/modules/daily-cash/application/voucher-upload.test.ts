import { describe, expect, it } from "vitest";
import { parseUploads, type UploadedFile } from "./voucher-upload";

const HEADER = [null, "Tipo", "Número", "Fecha", "Afecta", "Afectado por", "Vr. Total", "Tercero", "Detalle Obs/Anexo"];
const grid = (...rows: unknown[][]) => [[], [], [], [], [], HEADER, ...rows.map((r) => [null, ...r])] as never[][];
const voucher = (tipo: string, numero: string, value: number) => [tipo, numero, "2026-11-26", "", "", value, "T", "DETALLE /"];

const file = (name: string, ...sheets: never[][][]): UploadedFile => ({ name, sheets });

describe("parseUploads", () => {
  it("merges the rows of several files, remembering which file each came from", () => {
    const result = parseUploads([
      file("EC1.xlsx", grid(voucher("EC1", "0000000001", 1000))),
      file("EGT.xlsx", grid(voucher("EGT", "0000000002", 2000))),
    ]);
    expect(result.rows.map((r) => [r.file, r.company, r.voucherNumber])).toEqual([
      ["EC1.xlsx", "EC1", "1"],
      ["EGT.xlsx", "EGT", "2"],
    ]);
    expect(result.fileErrors).toEqual([]);
  });

  it("lists the skipped rows with their file", () => {
    const result = parseUploads([file("a.xlsx", grid(voucher("RC", "0000000001", 1000)))]);
    expect(result.rows).toEqual([]);
    expect(result.skipped).toEqual([{ file: "a.xlsx", rowNumber: 7, reason: expect.stringContaining("RC") }]);
  });

  it("reports a file that is not a voucher export without stopping the others", () => {
    const result = parseUploads([file("bad.xlsx", [["nada"]] as never[][]), file("ok.xlsx", grid(voucher("EC1", "0000000001", 1000)))]);
    expect(result.fileErrors).toEqual([{ file: "bad.xlsx", error: expect.stringMatching(/encabezados/i) }]);
    expect(result.rows).toHaveLength(1);
  });

  it("reads every sheet of a workbook and ignores the ones that are not vouchers", () => {
    const result = parseUploads([file("a.xlsx", [["otra hoja"]] as never[][], grid(voucher("EC1", "0000000001", 1000)))]);
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
  });
});
