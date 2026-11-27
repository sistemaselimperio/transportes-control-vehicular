import { describe, expect, it } from "vitest";
import {
  classifyImport,
  cleanDetail,
  normalizeVoucherNumber,
  parseVoucherSheet,
  parseVoucherValue,
  voucherKey,
  type Cell,
  type ParsedVoucher,
} from "./voucher-import";

const HEADER = ["Tipo", "Número", "Fecha", "Afecta", "Afectado por", "Vr. Total", "Tercero", "Detalle Obs/Anexo", "Elaboración", "Usuario"];

/** The accounting export: company and NIT on top, the headers on row 6, data after (columns start at B). */
const sheet = (...dataRows: Cell[][]): Cell[][] => [
  [null, "PAEZ LANCHEROS FABIAN LEONARDO"],
  [null, "NIT. 74439231-1"],
  [],
  [],
  [],
  [null, ...HEADER],
  ...dataRows.map((r) => [null, ...r]),
];

const voucher = (tipo: Cell, numero: Cell, value: Cell, detail: Cell): Cell[] => [
  tipo,
  numero,
  "2026-11-26",
  "",
  "",
  value,
  "TERCERO",
  detail,
  "Nov-26-2026",
  "LAITON",
];

describe("normalizeVoucherNumber", () => {
  it("strips leading zeros", () => {
    expect(normalizeVoucherNumber("0000005142")).toBe("5142");
  });

  it("accepts a numeric cell", () => {
    expect(normalizeVoucherNumber(5142)).toBe("5142");
  });

  it("keeps a single zero for an all-zero number", () => {
    expect(normalizeVoucherNumber("0000")).toBe("0");
  });

  it("is null when blank", () => {
    expect(normalizeVoucherNumber("  ")).toBeNull();
    expect(normalizeVoucherNumber(null)).toBeNull();
    expect(normalizeVoucherNumber(undefined)).toBeNull();
  });
});

describe("cleanDetail", () => {
  it("trims the trailing slash the software appends", () => {
    expect(cleanDetail("ANTICIPO VIAJE A HOLCIM VCU319 NELSON ANTONIO /")).toBe("ANTICIPO VIAJE A HOLCIM VCU319 NELSON ANTONIO");
  });

  it("trims surrounding whitespace and repeated trailing marks", () => {
    expect(cleanDetail("  ANTICIPO  / /  ")).toBe("ANTICIPO");
  });

  it("keeps a slash that is inside the text", () => {
    expect(cleanDetail("PEAJE IDA/VUELTA /")).toBe("PEAJE IDA/VUELTA");
  });

  it("is empty for a blank cell", () => {
    expect(cleanDetail(null)).toBe("");
    expect(cleanDetail(undefined)).toBe("");
  });
});

describe("parseVoucherValue", () => {
  it("reads whole-peso numbers", () => {
    expect(parseVoucherValue(200000)).toBe(200000);
  });

  it("reads text with thousands separators and a currency sign", () => {
    expect(parseVoucherValue("$ 1.200.000")).toBe(1200000);
    expect(parseVoucherValue("584200")).toBe(584200);
  });

  it("rejects zero, negatives and blanks", () => {
    expect(parseVoucherValue(0)).toBeNull();
    expect(parseVoucherValue(-5)).toBeNull();
    expect(parseVoucherValue("")).toBeNull();
    expect(parseVoucherValue(null)).toBeNull();
    expect(parseVoucherValue("abc")).toBeNull();
  });

  it("rejects values above the int4 maximum", () => {
    expect(parseVoucherValue(2_147_483_647)).toBe(2_147_483_647);
    expect(parseVoucherValue(2_147_483_648)).toBeNull();
    expect(parseVoucherValue("3.000.000.000")).toBeNull();
  });

  it("rounds a fractional number to whole pesos", () => {
    expect(parseVoucherValue(1000.4)).toBe(1000);
  });
});

describe("parseVoucherSheet", () => {
  it("reads the rows under the headers, normalized", () => {
    const result = parseVoucherSheet(sheet(voucher("EC1", "0000005142", 200000, "ANTICIPO VIAJE A HOLCIM VCU319 NELSON ANTONIO /")));
    expect(result.error).toBeNull();
    expect(result.skipped).toEqual([]);
    expect(result.rows).toEqual([
      { rowNumber: 7, company: "EC1", voucherNumber: "5142", detail: "ANTICIPO VIAJE A HOLCIM VCU319 NELSON ANTONIO", value: 200000 },
    ]);
  });

  it("finds the headers wherever they are, even with a mis-encoded accent", () => {
    const grid = [
      ["x"],
      ["Tipo", "N�mero", "Fecha", "Vr. Total", "Detalle Obs/Anexo"],
      ["EGT", "0000000900", "2026-11-26", 50000, "PEAJE /"],
    ];
    const result = parseVoucherSheet(grid);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([{ rowNumber: 3, company: "EGT", voucherNumber: "900", detail: "PEAJE", value: 50000 }]);
  });

  it("ignores the trailing total row and blank rows silently", () => {
    const result = parseVoucherSheet(
      sheet(
        voucher("EC1", "0000005142", 200000, "A /"),
        [null, null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, 2212200],
      ),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it("skips a type that is not EC1 or EGT, saying why", () => {
    const result = parseVoucherSheet(sheet(voucher("RC", "0000000001", 1000, "X /")));
    expect(result.rows).toEqual([]);
    expect(result.skipped).toEqual([{ rowNumber: 7, reason: expect.stringContaining("RC") }]);
  });

  it("skips a row without number or without value, saying why", () => {
    const result = parseVoucherSheet(sheet(voucher("EC1", "", 1000, "X /"), voucher("EC1", "0000000002", "", "Y /")));
    expect(result.rows).toEqual([]);
    expect(result.skipped.map((s) => s.rowNumber)).toEqual([7, 8]);
    expect(result.skipped[0].reason).toMatch(/número/i);
    expect(result.skipped[1].reason).toMatch(/valor/i);
  });

  it("accepts the type in lower case and with spaces", () => {
    const result = parseVoucherSheet(sheet(voucher(" ec1 ", "0000000003", 1000, "X /")));
    expect(result.rows[0].company).toBe("EC1");
  });

  it("falls back to a placeholder when the detail is empty", () => {
    const result = parseVoucherSheet(sheet(voucher("EC1", "0000000004", 1000, " / ")));
    expect(result.rows[0].detail).toBe("Sin detalle");
  });

  it("reports an error when the headers are not found", () => {
    const result = parseVoucherSheet([["nada"], ["que ver"]]);
    expect(result.rows).toEqual([]);
    expect(result.error).toMatch(/encabezados/i);
  });
});

const row = (company: "EC1" | "EGT", voucherNumber: string, rowNumber = 1): ParsedVoucher => ({
  rowNumber,
  company,
  voucherNumber,
  detail: "D",
  value: 1000,
});

describe("voucherKey", () => {
  it("joins company and number", () => {
    expect(voucherKey("EC1", "5142")).toBe("EC1:5142");
  });
});

describe("classifyImport", () => {
  it("imports rows nobody has stored", () => {
    const { toImport, duplicates } = classifyImport([row("EC1", "1"), row("EGT", "1")], new Set());
    expect(toImport).toHaveLength(2);
    expect(duplicates).toEqual([]);
  });

  it("blocks a voucher already stored, in any box", () => {
    const { toImport, duplicates } = classifyImport([row("EC1", "1"), row("EC1", "2")], new Set(["EC1:1"]));
    expect(toImport.map((r) => r.voucherNumber)).toEqual(["2"]);
    expect(duplicates).toEqual([{ row: expect.objectContaining({ voucherNumber: "1" }), reason: "stored" }]);
  });

  it("does not confuse the same number of the other company", () => {
    const { toImport } = classifyImport([row("EGT", "1")], new Set(["EC1:1"]));
    expect(toImport).toHaveLength(1);
  });

  it("keeps the first of a voucher repeated within the upload and blocks the rest", () => {
    const { toImport, duplicates } = classifyImport([row("EC1", "7", 7), row("EC1", "7", 9)], new Set());
    expect(toImport.map((r) => r.rowNumber)).toEqual([7]);
    expect(duplicates).toEqual([{ row: expect.objectContaining({ rowNumber: 9 }), reason: "repeated" }]);
  });
});
