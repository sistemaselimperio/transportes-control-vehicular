import { describe, expect, it } from "vitest";
import {
  detectStatusWord,
  isPlateLike,
  parseClassCell,
  parseDateCell,
  parseDocumentCell,
  parseDriverCell,
  parseKmCell,
  parseNextChangeCell,
  parseOilDateCell,
  parsePhoneCell,
  parsePlateCell,
  parsePolicyCell,
  parseServiceCell,
  parseTaxCell,
  parseTrailerReference,
} from "./cell-parsers";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("parseDateCell", () => {
  it("reads Excel dates", () => {
    expect(parseDateCell(utc(2026, 9, 14), "SOAT")).toEqual({
      value: "2026-09-14",
      issues: [],
    });
  });

  it("reads text dates with stray spaces and newlines", () => {
    expect(parseDateCell(" 21/10/2026", "TECNO").value).toBe("2026-10-21");
    expect(parseDateCell("\n11/05/2027", "TECNO").value).toBe("2027-05-11");
    expect(parseDateCell("7/07/2027", "TECNO").value).toBe("2027-07-07");
  });

  it("treats empty cells and the Excel zero date as no data", () => {
    expect(parseDateCell(null, "SOAT")).toEqual({ value: null, issues: [] });
    expect(parseDateCell("  ", "SOAT").value).toBeNull();
    expect(parseDateCell(utc(1899, 12, 30), "SOAT")).toEqual({
      value: null,
      issues: [],
    });
  });

  it("flags years outside 2000..2100 as errors and leaves the value empty", () => {
    const r = parseDateCell(utc(2641, 6, 28), "Aproximada");
    expect(r.value).toBeNull();
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ level: "error", field: "Aproximada" });
    expect(r.issues[0].message).toContain("2641");
  });

  it("flags impossible calendar dates and unreadable text", () => {
    expect(parseDateCell("31/02/2026", "SOAT").issues[0].level).toBe("error");
    expect(parseDateCell("pronto", "SOAT").issues[0].level).toBe("error");
  });
});

describe("parseDocumentCell", () => {
  it("returns the expiry date", () => {
    expect(parseDocumentCell(utc(2027, 5, 12), "SOAT")).toEqual({
      expiresOn: "2027-05-12",
      notApplicable: false,
      issues: [],
    });
  });

  it("treats NUEVA / NO TIENE / NO APLICA as not applicable", () => {
    for (const text of ["NUEVA", "no tiene", "NO APLICA"]) {
      expect(parseDocumentCell(text, "TECNO")).toEqual({
        expiresOn: null,
        notApplicable: true,
        issues: [],
      });
    }
  });

  it("keeps empty cells as no data", () => {
    expect(parseDocumentCell(null, "SOAT")).toEqual({
      expiresOn: null,
      notApplicable: false,
      issues: [],
    });
  });
});

describe("parsePolicyCell", () => {
  it("splits kind and date", () => {
    expect(parsePolicyCell("TR          7/07/2027")).toMatchObject({
      kind: "TR",
      expiresOn: "2027-07-07",
      notApplicable: false,
    });
    expect(parsePolicyCell("  RC  30/09/2027")).toMatchObject({
      kind: "RC",
      expiresOn: "2027-09-30",
    });
  });

  it("keeps the kind unknown for a bare date", () => {
    expect(parsePolicyCell(utc(2027, 8, 27))).toMatchObject({
      kind: null,
      expiresOn: "2027-08-27",
    });
  });

  it("maps NO TIENE, VENDIDA and free notes", () => {
    expect(parsePolicyCell("NO TIENE").notApplicable).toBe(true);
    expect(parsePolicyCell("VENDIDA").sold).toBe(true);
    expect(parsePolicyCell("COMPRO")).toMatchObject({
      note: "Póliza: COMPRO",
      expiresOn: null,
    });
    expect(parsePolicyCell("NO HAY CARPETA").note).toBe("Póliza: NO HAY CARPETA");
  });

  it("returns nothing for an empty cell", () => {
    expect(parsePolicyCell(null)).toMatchObject({
      kind: null,
      expiresOn: null,
      notApplicable: false,
      sold: false,
      note: null,
      issues: [],
    });
  });

  it("warns about unrecognized text", () => {
    const r = parsePolicyCell("XYZ");
    expect(r.issues[0]).toMatchObject({ level: "warning", field: "Póliza" });
  });
});

describe("parseTaxCell", () => {
  it("reads paid years", () => {
    expect(parseTaxCell(2026, 2026)).toEqual({
      kind: "PAID_YEAR",
      year: 2026,
      issues: [],
    });
  });

  it("maps AL DIA to the current year", () => {
    expect(parseTaxCell("AL DIA", 2026)).toMatchObject({
      kind: "PAID_YEAR",
      year: 2026,
    });
  });

  it("maps NO PAGA and the low displacement label", () => {
    expect(parseTaxCell("NO PAGA", 2026).kind).toBe("EXEMPT");
    expect(
      parseTaxCell("NO PAGA POR KILOMETRAJE INFERIOR 214", 2026).kind,
    ).toBe("EXEMPT_LOW_DISPLACEMENT");
  });

  it("maps 0 and empty to UNKNOWN", () => {
    expect(parseTaxCell(0, 2026).kind).toBe("UNKNOWN");
    expect(parseTaxCell(null, 2026).kind).toBe("UNKNOWN");
  });

  it("warns on unrecognized values", () => {
    const r = parseTaxCell("QUIEN SABE", 2026);
    expect(r.kind).toBe("UNKNOWN");
    expect(r.issues[0].level).toBe("warning");
  });
});

describe("parseKmCell", () => {
  it("reads numbers", () => {
    expect(parseKmCell(359174)).toEqual({
      km: 359174,
      odometerWorking: true,
      issues: [],
    });
  });

  it("detects a broken odometer from text", () => {
    for (const text of ["NO SE SI SIRVE KILOM ", "NO SIRVE KILOMETRAJE"]) {
      expect(parseKmCell(text)).toEqual({
        km: null,
        odometerWorking: false,
        issues: [],
      });
    }
  });

  it("accepts empty and warns on other text", () => {
    expect(parseKmCell(null).km).toBeNull();
    expect(parseKmCell("mucho").issues[0].level).toBe("warning");
  });
});

describe("parsePhoneCell", () => {
  it("reads 10-digit numbers", () => {
    expect(parsePhoneCell(3137546359)).toEqual({ phone: "3137546359", note: null });
    expect(parsePhoneCell("313 754 6359").phone).toBe("3137546359");
  });

  it("turns other text into a note", () => {
    expect(parsePhoneCell("FOTO KILOM")).toEqual({
      phone: null,
      note: "Celular: FOTO KILOM",
    });
  });

  it("turns a date in the phone column into a note", () => {
    expect(parsePhoneCell(utc(2026, 8, 4)).note).toContain("2026-08-04");
  });
});

describe("parseClassCell", () => {
  it("splits class and brand line", () => {
    expect(parseClassCell("TRACTOCAMION KENWORTH T800")).toMatchObject({
      className: "Tractocamión",
      brandLine: "KENWORTH T800",
      guessed: false,
    });
    expect(parseClassCell("CAMIONETA NISSAN D22/NP300")).toMatchObject({
      className: "Camioneta",
      brandLine: "NISSAN D22/NP300",
    });
    expect(parseClassCell("CAMION CHEVROLET NPR").className).toBe("Camión");
    expect(parseClassCell("CAMPERO TOYOTA ESTACAS").className).toBe("Campero");
    expect(parseClassCell("MOTOCICLETA YAMAHA XTZ125").className).toBe(
      "Motocicleta",
    );
    expect(parseClassCell("AUTOMOVIL RENAULT KWID").className).toBe("Automóvil");
  });

  it("accepts the MOTOCARO typo", () => {
    expect(parseClassCell("MOTOCARO FURGON BAJAJ ")).toMatchObject({
      className: "Motocarro",
      brandLine: "FURGON BAJAJ",
    });
  });

  it("guesses the class for brand-only texts and warns", () => {
    const prado = parseClassCell("TOYOTA PRADO");
    expect(prado).toMatchObject({
      className: "Campero",
      brandLine: "TOYOTA PRADO",
      guessed: true,
    });
    expect(prado.issues[0].level).toBe("warning");
    expect(parseClassCell("SUZUKI SWIF MOD. 2023").className).toBe("Automóvil");
    expect(parseClassCell("COOPER C").className).toBe("Automóvil");
    expect(parseClassCell("VITARA").className).toBe("Campero");
  });

  it("returns no class for empty text", () => {
    expect(parseClassCell(null)).toMatchObject({
      className: null,
      brandLine: null,
    });
  });
});

describe("detectStatusWord", () => {
  it("detects idle and workshop words including typos", () => {
    expect(detectStatusWord("QUIETA")).toBe("IDLE");
    expect(detectStatusWord("QUIETA 30 JULIO")).toBe("IDLE");
    expect(detectStatusWord("QIETA SEP 9 2026")).toBe("IDLE");
    expect(detectStatusWord("TALLER")).toBe("IN_WORKSHOP");
    expect(detectStatusWord("ESTA TALLER 20 SPE")).toBe("IN_WORKSHOP");
    expect(detectStatusWord("QUIETA TALLER 18 SEP")).toBe("IN_WORKSHOP");
    expect(detectStatusWord("HECTOR")).toBeNull();
  });
});

describe("parseDriverCell", () => {
  it("returns names", () => {
    expect(parseDriverCell("HECTOR MONTAÑO ")).toEqual({
      driverName: "HECTOR MONTAÑO",
      status: null,
      note: null,
    });
  });

  it("flattens multiple spaces", () => {
    expect(parseDriverCell("CRISTIAN HERNANDEZ  ALMACEN SAMACA").driverName).toBe(
      "CRISTIAN HERNANDEZ ALMACEN SAMACA",
    );
  });

  it("maps status words to a vehicle status", () => {
    expect(parseDriverCell("QUIETA")).toMatchObject({
      driverName: null,
      status: "IDLE",
    });
  });

  it("treats unassigned markers as no driver", () => {
    expect(parseDriverCell("SIN ASIGNAR").driverName).toBeNull();
    expect(parseDriverCell("SIN ASUGNAR").driverName).toBeNull();
    const fluid = parseDriverCell("CONDUCTOR NO FIJO  BODEGA");
    expect(fluid.driverName).toBeNull();
    expect(fluid.note).toBe("Conductor: CONDUCTOR NO FIJO BODEGA");
  });

  it("turns non-name text into notes", () => {
    for (const text of ["VOLVADO", "COMENZO A TRABAJAR", "COMENO TRABAJAR 2 SEPT/2026", "ALMACEN"]) {
      const r = parseDriverCell(text);
      expect(r.driverName).toBeNull();
      expect(r.note).toBe(`Conductor: ${text}`);
    }
  });
});

describe("parseOilDateCell", () => {
  it("reads dates", () => {
    expect(parseOilDateCell(utc(2026, 9, 14))).toMatchObject({
      date: "2026-09-14",
      status: null,
    });
  });

  it("maps TALLER to the workshop status", () => {
    expect(parseOilDateCell("TALLER")).toMatchObject({
      date: null,
      status: "IN_WORKSHOP",
    });
  });

  it("treats NO HAY REGISTRO as no oil record without issues", () => {
    for (const text of ["NO HAY REGISTRO DE CAMBIO", "NO HAY REGISTRO FECHA", "NO HAY REGISTRO DE CAMBIO CELULAR"]) {
      expect(parseOilDateCell(text)).toEqual({ date: null, status: null, issues: [] });
    }
  });
});

describe("parseNextChangeCell", () => {
  it("reads km numbers", () => {
    expect(parseNextChangeCell(379174)).toMatchObject({
      nextKm: 379174,
      nextDate: null,
    });
  });

  it("reads dates", () => {
    expect(parseNextChangeCell(utc(2026, 10, 29))).toMatchObject({
      nextKm: null,
      nextDate: "2026-10-29",
    });
  });

  it("maps QUIETA to idle", () => {
    expect(parseNextChangeCell("QUIETA")).toMatchObject({ status: "IDLE" });
  });

  it("returns nothing for empty", () => {
    expect(parseNextChangeCell(null)).toEqual({
      nextKm: null,
      nextDate: null,
      status: null,
      issues: [],
    });
  });
});

describe("plates", () => {
  it("recognizes real plate shapes", () => {
    for (const p of ["JVK-590", "GZZ- 184", "O35-ADL", "ZAP-85F ", "VLT21F", "S91997", "R09022"]) {
      expect(isPlateLike(p)).toBe(true);
    }
    for (const p of ["SUZUKI SWIF MOD. 2023", "COOPER C", "NO UBICADO PROPIETARIO", ""]) {
      expect(isPlateLike(p)).toBe(false);
    }
  });

  it("normalizes valid plates and reports invalid ones", () => {
    expect(parsePlateCell(" XVI-282")).toMatchObject({ plate: "XVI-282", issues: [] });
    expect(parsePlateCell("GZZ- 184").plate).toBe("GZZ-184");
    expect(parsePlateCell("LFL-14H").plate).toBe("LFL14H");
    const bad = parsePlateCell("ABC");
    expect(bad.plate).toBeNull();
    expect(bad.issues[0]).toMatchObject({ level: "error", field: "Placa" });
  });
});

describe("parseServiceCell", () => {
  it("maps known values", () => {
    expect(parseServiceCell("PUBLICO")).toBe("PUBLICO");
    expect(parseServiceCell("PARTICULAR")).toBe("PARTICULAR");
    expect(parseServiceCell(null)).toBeNull();
  });
});

describe("parseTrailerReference", () => {
  it("splits plate, brand line and old plate", () => {
    expect(parseTrailerReference("S88490 TANQUE GASOLINA")).toEqual({
      plateText: "S88490",
      brandLine: "TANQUE GASOLINA",
      note: null,
    });
    expect(parseTrailerReference("S91997  (R29694)")).toEqual({
      plateText: "S91997",
      brandLine: null,
      note: "Placa anterior (R29694)",
    });
    expect(parseTrailerReference("R18936").plateText).toBe("R18936");
  });
});
