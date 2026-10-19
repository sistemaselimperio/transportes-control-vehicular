import { describe, expect, it } from "vitest";
import type { CellValue } from "./cell-parsers";
import {
  parseImperioSheet,
  parsePaezSheet,
  parseTrailerSheet,
  parseWorkbook,
} from "./parse-sheets";
import type { RawRow, RawSheet } from "./types";

const TODAY = "2026-10-17";
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const row = (rowNumber: number, cells: Record<string, CellValue>): RawRow => ({
  rowNumber,
  cells,
});

const imperioHeader = row(2, {
  B: "ITEMS", C: "CLASE VEHICULO", D: "PLACA ", E: "POLIZA TODO RIESGO",
  F: "MUNICIPIO", G: "SERVICIO", H: "IMPUESTO", I: "CONDUCTOR", J: "CELULAR",
  K: "F. CAMBIO", L: "KILOMETRAJE", M: "PROX.CAMBIO", N: "SOAT", O: "TECNO",
});

const imperio: RawSheet = {
  name: "T. IMPERIO",
  rows: [
    row(1, { B: "TRANSPORTES EL IMPERIO  901838598", C: "TRANSPORTES EL IMPERIO  901838598" }),
    imperioHeader,
    row(3, {
      B: 1, C: "TRACTOCAMION KENWORTH T800", D: "JVK-590",
      E: "TR          7/07/2027", F: "COTA-CUND", G: "PUBLICO", H: "NO PAGA",
      I: "HECTOR MONTAÑO ", J: 3137546359, K: utc(2026, 9, 14), L: 359174,
      M: 379174, N: utc(2027, 5, 12), O: utc(2027, 5, 8),
    }),
    row(5, {
      B: 3, C: "TRACTOCAMION KENWORTH T800", D: "SQL-877",
      E: "RC       14/01/2027", F: "COTA-CUND", G: "PUBLICO", H: "NO PAGA",
      I: "ORLANDO SANCHEZ", K: utc(2026, 8, 29), L: "NO SE SI SIRVE KILOM ",
      M: utc(2026, 10, 29), N: utc(2026, 12, 17), O: utc(2026, 12, 18),
    }),
    row(8, {
      B: 6, C: "CAMION CHEVROLET NPR", D: "WOY-902", E: "RC         9/09/2027",
      F: "FUNZA-CUND", G: "PUBLICO", H: "NO PAGA", I: "MIGUEL", J: "FOTO KILOM",
      K: utc(2026, 8, 27), L: 294484, M: 301484, N: utc(2027, 3, 27), O: utc(2027, 4, 8),
    }),
    row(13, {
      B: 11, C: "CAMION CHEVROLET KODIAK 209 7000", D: " XVI-282", E: "NO TIENE",
      F: "FLORIDA BLANCA", G: "PUBLICO", H: 2026, I: "CESAR CUITIVA",
      J: 3124275583, K: utc(2026, 6, 27), L: 347350, M: 355350,
      N: utc(2027, 9, 30), O: utc(2027, 2, 20),
    }),
    row(16, {
      B: 14, C: "CAMION MERCEDES BENZ ATEGO 2730K", D: "JSL-978",
      E: "TR          7/07/2027", F: "CAJICA-CUND", G: "PUBLICO", H: "NO PAGA",
      I: "JAIME CASTAÑEDA", J: 3142661585, K: utc(2026, 8, 31),
      L: "NO SE SI SIRVE KILOM ", M: utc(2026, 10, 31), N: utc(2026, 10, 19),
      O: " 21/10/2026",
    }),
    row(17, {
      B: 15, C: "CAMION CHEVROLET BRIGADIER TANDEM 221", D: "SDL-959",
      E: "RC     4/06/2027", F: "YUMBO", G: "PUBLICO", H: "AL DIA",
      I: "WILMAR VARGAS", J: 3133566383, K: utc(2026, 8, 8),
      L: "NO SE SI SIRVE KILOM ", M: utc(2026, 10, 8), N: utc(2027, 1, 8),
      O: utc(2027, 2, 20), P: "QUIETA",
    }),
    row(23, {
      B: 21, C: "CAMIONETA HINO XZU640L-HKMLN3", D: "WOU-620", E: "TR   7/07/2027",
      F: "COTA-CUND", G: "PUBLICO", H: "NO PAGA", J: 3134795353,
      K: utc(2026, 9, 26), L: 146527, M: 152527, N: utc(2027, 7, 11), O: utc(2027, 4, 4),
    }),
    row(24, {
      B: 22, C: "CAMIONETA JAC HFC1036KN EVI", D: "NOL-060", E: "TR   7/07/2027",
      F: "COTA-CUND", G: "PUBLICO", H: "NO PAGA", K: utc(2026, 10, 3), L: 36233,
      M: 42233, N: utc(2027, 4, 8), O: "NUEVA",
    }),
    row(28, {
      B: 26, C: "MOTOCARO FURGON BAJAJ ", D: "O35-ADL", E: "NO TIENE",
      F: "ZIPAQUIRA", H: 2026, I: "QUIETA", J: 3132066061, K: utc(2026, 1, 2),
      M: "QUIETA", N: utc(2026, 10, 28), O: "NUEVA",
    }),
    row(31, {
      B: 29, C: "MOTOCICLETA YAMAHA XTZ125", D: "LFL-14H", E: "NO TIENE",
      F: "CHIQUINQUIRA", H: "NO PAGA POR KILOMETRAJE INFERIOR 214", I: "DON FABIAN ",
      N: utc(2027, 5, 20), O: "NUEVA",
    }),
    row(33, {
      B: 31, C: "TOYOTA PRADO", D: "MPQ-910", E: "NO TIENE", F: "BOGOTA", H: 2026,
      I: "DON FABIAN ", N: utc(2027, 9, 22), O: utc(2027, 1, 2),
    }),
    row(34, {
      B: 32, C: "CAMION FORD 8000", D: "UFO-003", E: "COMPRO", I: "QUIETA",
      K: utc(2026, 7, 30), M: utc(2026, 9, 30), N: utc(2027, 6, 16), O: utc(2027, 9, 27),
    }),
    row(37, {
      C: "CAMPERO TOYOTA LAND CRUISER PRADO", D: "PHU-161", E: "VENDIDA", F: "CHIA",
      H: 2026, I: "DON FABIAN ", K: "NO HAY REGISTRO DE CAMBIO CELULAR",
      N: utc(2026, 10, 23), O: "NUEVA",
    }),
  ],
};

function byPlate<T extends { plate: string }>(list: T[], plate: string): T {
  const found = list.find((v) => v.plate === plate);
  if (!found) throw new Error(`plate ${plate} not parsed`);
  return found;
}

describe("parseImperioSheet", () => {
  const { vehicles, rejected } = parseImperioSheet(imperio, TODAY);

  it("parses a complete row", () => {
    const v = byPlate(vehicles, "JVK-590");
    expect(v).toMatchObject({
      className: "Tractocamión",
      brandLine: "KENWORTH T800",
      owner: { kind: "IMPERIO" },
      municipality: "COTA-CUND",
      serviceType: "PUBLICO",
      status: "ACTIVE",
      odometerWorking: true,
      currentKm: 359174,
      currentKmAt: "2026-09-14",
      tax: { kind: "EXEMPT", year: null },
      policy: { kind: "TR", expiresOn: "2027-07-07", notApplicable: false },
      soat: { expiresOn: "2027-05-12", notApplicable: false },
      tecno: { expiresOn: "2027-05-08", notApplicable: false },
      driver: { name: "HECTOR MONTAÑO", phone: "3137546359" },
      oilChange: {
        date: "2026-09-14",
        km: 359174,
        nextKm: 379174,
        nextDate: null,
      },
      sale: null,
    });
    expect(v.issues).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it("detects a broken odometer and a next-change date", () => {
    const v = byPlate(vehicles, "SQL-877");
    expect(v.odometerWorking).toBe(false);
    expect(v.currentKm).toBeNull();
    expect(v.oilChange).toEqual({
      date: "2026-08-29",
      km: null,
      nextKm: null,
      nextDate: "2026-10-29",
    });
    expect(v.policy?.kind).toBe("RC");
  });

  it("puts phone-column text into notes", () => {
    const v = byPlate(vehicles, "WOY-902");
    expect(v.driver).toEqual({ name: "MIGUEL", phone: null });
    expect(v.notes).toContain("Celular: FOTO KILOM");
  });

  it("normalizes plates with stray spaces", () => {
    expect(byPlate(vehicles, "XVI-282").policy).toMatchObject({
      notApplicable: true,
    });
  });

  it("parses text dates with leading spaces", () => {
    expect(byPlate(vehicles, "JSL-978").tecno?.expiresOn).toBe("2026-10-21");
  });

  it("marks the vehicle idle from the extra status column", () => {
    expect(byPlate(vehicles, "SDL-959")).toMatchObject({
      status: "IDLE",
      tax: { kind: "PAID_YEAR", year: 2026 },
    });
  });

  it("keeps a phone without a driver as a note", () => {
    const v = byPlate(vehicles, "WOU-620");
    expect(v.driver).toBeNull();
    expect(v.notes).toContain("Celular sin conductor: 3134795353");
  });

  it("treats NUEVA tecnomecánica as not applicable", () => {
    expect(byPlate(vehicles, "NOL-060").tecno).toMatchObject({
      notApplicable: true,
      expiresOn: null,
    });
  });

  it("parses idle motocarros with QUIETA in driver and next-change", () => {
    const v = byPlate(vehicles, "O35-ADL");
    expect(v).toMatchObject({
      className: "Motocarro",
      brandLine: "FURGON BAJAJ",
      status: "IDLE",
      driver: null,
      oilChange: { date: "2026-01-02", nextKm: null, nextDate: null },
    });
    expect(v.serviceType).toBe("PARTICULAR");
  });

  it("normalizes motorcycle plates and the low displacement tax", () => {
    expect(byPlate(vehicles, "LFL14H")).toMatchObject({
      className: "Motocicleta",
      tax: { kind: "EXEMPT_LOW_DISPLACEMENT", year: null },
      oilChange: null,
    });
  });

  it("guesses the class for brand-only text and warns", () => {
    const v = byPlate(vehicles, "MPQ-910");
    expect(v.className).toBe("Campero");
    expect(v.issues.some((i) => i.level === "warning" && i.field === "Clase")).toBe(true);
  });

  it("keeps COMPRO as a note and idle from the driver column", () => {
    const v = byPlate(vehicles, "UFO-003");
    expect(v.policy).toBeNull();
    expect(v.notes).toContain("Póliza: COMPRO");
    expect(v.status).toBe("IDLE");
  });

  it("detects sold vehicles and skips driver and oil change", () => {
    const v = byPlate(vehicles, "PHU-161");
    expect(v).toMatchObject({
      status: "SOLD",
      sale: { buyer: null },
      driver: null,
      oilChange: null,
      className: "Campero",
    });
  });

  it("warns when the service is empty", () => {
    const v = byPlate(vehicles, "O35-ADL");
    expect(v.issues.some((i) => i.field === "Servicio")).toBe(true);
  });
});

const paezHeader = row(3, {
  B: "ITEMS", C: "CLASE VEHICULO", D: "PLACA ", E: "POLIZA TODO RIESGO",
  H: "IMPUESTO VEHICULAR", I: "CONDUCTOR", J: "CELULAR", K: "FECHA CAMBIO ACEITE",
  L: "KILOMETRAJE", M: "PROX. CAMBIO", N: "APROXIMADA", P: "TECNO",
  R: "ITEMS", S: "PLACA ", T: "CLASE", U: "SOAT", V: "TECNOMECANICA",
  W: "CELULAR", X: "POLIZA TODO RIESGO", Y: "IMPUESTO",
});

const paez: RawSheet = {
  name: "F.PAEZ",
  rows: [
    row(2, { B: "FABIAN PAEZ  74439231", C: "FABIAN PAEZ  74439231", R: "SANDRA MARCELA PAEZ PORRA", U: 1053323036 }),
    paezHeader,
    row(4, {
      B: 1, C: "TRACTOCAMION KENWORTH T800", D: "WOM-158",
      E: "TR            7/07/2027", F: "BUCARAMANGA", G: "PUBLICO",
      I: "FREDY MORALES ", J: 3118298991, K: utc(2026, 9, 7), L: 512440, M: 532440,
      O: utc(2027, 9, 22), P: " 20/10/2026",
      R: 1, S: "LNZ-709", T: "SUZUKI SWIF MOD. 2023", U: utc(2027, 5, 18),
      W: 3214731369, X: utc(2026, 5, 30), Y: 2025,
    }),
    row(5, {
      B: 2, C: "TRACTOCAMION KENWORTH T800", D: "TPW-754 ", E: utc(2027, 8, 27),
      F: "MEDELLIN", G: "PUBLICO", H: 2026, I: "JAIRO RUIZ ", J: 3157946892,
      K: utc(2026, 6, 9), L: 1933552, M: 1953552, O: utc(2026, 10, 24), P: utc(2027, 10, 2),
      R: "NO UBICADO PROPIETARIO", S: "NO UBICADO PROPIETARIO",
    }),
    row(6, {
      B: 3, C: "TRACTOCAMION KENWORTH T800", D: "TRN-084 ", F: "BELLO-ANTQ", G: "PUBLICO",
      H: 2026, I: "MILTON DIAZ", K: utc(2026, 9, 19), L: 1102196, M: 1122196,
      O: " 29/11/2026", P: utc(2027, 7, 22), R: 1, S: "GTK-274", T: "TOYOTA",
    }),
    row(7, {
      B: 4, C: "TRACTOCAMION KENWORTH T800", D: "SKE-968", E: "RC  12/02/2027",
      F: "CAJICA-CUND", G: "PUBLICO", H: "NO PAGA", I: "RUPERTO MUÑOZ ", J: 3134236677,
      K: utc(2026, 8, 18), L: "NO SIRVE KILOMETRAJE", M: utc(2026, 10, 18), N: utc(2026, 10, 18),
      O: utc(2027, 6, 12), P: utc(2027, 6, 16), R: 2, S: "HIK-196",
    }),
    row(11, {
      B: 8, C: "TRACTOCAMION INTERNATIONAL 9400 ISBA 6x4", D: "VCU-319", E: utc(2027, 10, 7),
      F: "BELLO-ANTQ", G: "PUBLICO", H: 2026, I: "JOSE PAEZ", J: 3112266367,
      K: utc(2026, 6, 25), L: 125152, M: 145152, N: "QUIETA TALLER 18 SEP",
      O: utc(2027, 10, 2), P: utc(2027, 7, 28),
    }),
    row(13, {
      B: 10, C: "TRACTOCAMION FORD LT 9000", D: "SKG-868", F: "CAJICA-CUND", G: "PUBLICO",
      H: 0, I: "VICTOR SANCHEZ ", J: 3241273400, K: utc(2026, 9, 17),
      L: "NO SIRVE KILOMETRAJE", M: utc(2026, 11, 17), N: utc(2026, 11, 17),
      O: utc(2027, 4, 21), P: utc(2027, 7, 3), Q: "ESTA TALLER 20 SPE",
    }),
    row(15, {
      B: 12, C: "CAMION INTERNATIONAL 4300", D: "TZR-573 ", E: "TR     7/07/2027",
      F: "FUNZA-CUND", G: "PUBLICO", I: "COMENZO A TRABAJAR", J: utc(2026, 8, 4),
      K: utc(2026, 7, 7), M: utc(2026, 9, 7), N: utc(2026, 9, 7),
      O: utc(2027, 9, 16), P: utc(2027, 9, 18),
    }),
    row(16, {
      B: 13, C: "CAMION FREIGHTLINER FL 80", D: "SGM-767", F: "CAJICA-CUND", G: "PUBLICO",
      I: "VOLVADO", K: "NO HAY REGISTRO FECHA", O: utc(2023, 12, 8), P: utc(2024, 6, 26),
    }),
    row(17, {
      B: 14, C: "CAMION CHEVROLETH C 70", D: "THK-305", E: utc(2027, 3, 12),
      F: "CAJICA-CUND", G: "PUBLICO", H: 0, I: "VICENTE CAMACHO", J: 3145426156,
      K: "TALLER", L: "NO SIRVE KILOMETRAJE", N: utc(1899, 12, 30),
      O: utc(2027, 1, 28), P: utc(2027, 2, 2),
    }),
    row(18, {
      B: 15, C: "CAMION CHEVROLET FSR 32L", D: "SBN-441", E: "RC          4/04/2027",
      F: "CHIQUINQUIRA", G: "PUBLICO", H: 2026, I: "FREDY JAIMES", J: 3143094817,
      K: utc(2026, 7, 29), L: "NO SIRVE KILOMETRAJE", M: utc(2026, 9, 29),
      N: utc(2026, 9, 29), O: utc(2027, 5, 10), P: utc(2027, 8, 9), R: "VENDIDO",
    }),
    row(19, {
      B: 16, C: "CAMION CHEVROLET BRIGADIER 151", D: "QGV-374", E: "NO TIENE",
      F: "CHIQUINQUIRA", G: "PARTICULAR", H: 2026, J: 3127552023, K: utc(2026, 9, 2),
      L: "NO SIRVE KILOMETRAJE", M: utc(2026, 11, 2), N: utc(2026, 11, 2),
      O: utc(2027, 3, 2), P: utc(2027, 3, 3), Q: "LLEVO ZIP", R: 1, S: "QFR-193", T: "VITARA",
    }),
    row(20, {
      B: 17, C: "CAMIONETA CHEVROLET LUV D MAX", D: "QFO-955", E: utc(2025, 6, 24),
      F: "TUNJA -BOY", G: "PARTICULAR", H: 2026, I: "CRISTIAN HERNANDEZ  ALMACEN SAMACA",
      K: utc(2026, 9, 9), L: "NO SIRVE KILOMETRAJE", M: utc(2026, 11, 9), N: "QIETA SEP 9 2026",
      O: utc(2027, 1, 3), P: utc(2026, 9, 10),
      R: 1, S: "BTI-406", T: "CAMPERO CHEVROLET JIMNY", U: " 28/09/2025", V: utc(2025, 8, 28),
    }),
    row(21, {
      B: 18, C: "CAMIONETA CHEVROLET C 30", D: "GKJ-515", E: "NO HAY CARPETA",
      F: "BARBOSA -SANT", G: "PARTICULAR", H: 2026, I: "SIN ASIGNAR",
      K: "NO HAY REGISTRO FECHA", O: utc(2013, 4, 15), P: " 20/02/2013",
      R: 24, S: "AUTOMOVIL RENAULT KWID", T: "KCX-927",
      U: "VALENTINA PAEZ (HIJA DE DON FABIAN)", V: "CHIQUINQUIRA",
    }),
    row(23, {
      B: 20, C: "CAMIONETA NISSAN NP300 FRONTIER", D: "IRO-125", E: "NO TIENE",
      F: "BUCARAMANGA", H: 2026, I: "INGENIERO ALEJANDRO ", J: 3208043177,
      K: utc(2026, 9, 21), L: 263825, M: 270825, N: utc(2641, 6, 28),
      O: utc(2027, 3, 3), P: utc(2027, 2, 26),
    }),
    row(25, {
      B: 22, C: "MOTOCICLETA YAMAHA YB125ZR", D: "ZAP-85F ", E: "NO TIENE",
      F: "CHIQUINQUIRA", G: "PARTICULAR", H: "NO PAGA POR KILOMETRAJE INFERIOR 214",
      I: "QUIETA", J: 3183598201, K: "NO HAY REGISTRO FECHA", O: utc(2026, 5, 18), P: utc(2026, 5, 17),
    }),
    row(31, { B: "SANDRA MARCELA PAEZ PORRA", C: "SANDRA MARCELA PAEZ PORRA", J: 1053323036 }),
    row(32, {
      B: "ITEMS", C: "PLACA ", D: "CLASE", I: "SOAT", J: "TECNOMECANICA", K: "CELULAR",
      L: "POLIZA TODO RIESGO", M: "IMPUESTO", N: "SOAT", O: "TECNOMECANICA",
    }),
    row(33, {
      B: 1, C: "SUZUKI SWIF MOD. 2023", D: "LNZ-709", E: utc(2026, 5, 30), H: 2026,
      I: utc(2027, 5, 18), J: "NUEVA", K: 3214731369, L: utc(2027, 5, 30), N: utc(2027, 5, 18),
    }),
    row(34, {
      B: 2, C: "COOPER C", D: "PXX-516", E: 1053323036, I: utc(2027, 9, 23), J: "NUEVA",
      N: utc(2026, 9, 23),
    }),
  ],
};

describe("parsePaezSheet", () => {
  const { vehicles, rejected } = parsePaezSheet(paez, TODAY);

  it("uses the Fabián block with the extra column layout", () => {
    const v = byPlate(vehicles, "WOM-158");
    expect(v).toMatchObject({
      owner: { kind: "FABIAN" },
      soat: { expiresOn: "2027-09-22" },
      tecno: { expiresOn: "2026-10-20" },
      tax: { kind: "UNKNOWN", year: null },
    });
  });

  it("accepts a bare policy date with unknown kind", () => {
    expect(byPlate(vehicles, "TPW-754").policy).toMatchObject({
      kind: null,
      expiresOn: "2027-08-27",
    });
  });

  it("maps broken odometer, status text in the approximate column and workshop", () => {
    expect(byPlate(vehicles, "SKE-968").odometerWorking).toBe(false);
    const idleWorkshop = byPlate(vehicles, "VCU-319");
    expect(idleWorkshop.status).toBe("IN_WORKSHOP");
    expect(idleWorkshop.notes).toContain('Estado en Excel: "QUIETA TALLER 18 SEP"');
    expect(byPlate(vehicles, "SKG-868").status).toBe("IN_WORKSHOP");
    expect(byPlate(vehicles, "THK-305").status).toBe("IN_WORKSHOP");
    expect(byPlate(vehicles, "QFO-955").status).toBe("IDLE");
  });

  it("treats Excel zero dates as no data (no issue)", () => {
    expect(byPlate(vehicles, "THK-305").issues).toEqual([]);
  });

  it("turns non-name driver text into notes", () => {
    const comenzo = byPlate(vehicles, "TZR-573");
    expect(comenzo.driver).toBeNull();
    expect(comenzo.notes).toContain("Conductor: COMENZO A TRABAJAR");
    expect(comenzo.notes.some((n) => n.includes("2026-08-04"))).toBe(true);
    expect(byPlate(vehicles, "SGM-767").notes).toContain("Conductor: VOLVADO");
    expect(byPlate(vehicles, "SGM-767").oilChange).toBeNull();
    expect(byPlate(vehicles, "SGM-767").policy).toBeNull();
  });

  it("flags impossible approximate dates as errors but keeps the row", () => {
    const v = byPlate(vehicles, "IRO-125");
    const err = v.issues.find((i) => i.level === "error");
    expect(err).toMatchObject({ field: "Aproximada" });
    expect(err?.message).toContain("2641");
    expect(v.oilChange?.nextDate).toBeNull();
    expect(v.oilChange?.nextKm).toBe(270825);
  });

  it("ignores the unassigned marker and keeps notes from the extra column", () => {
    expect(byPlate(vehicles, "GKJ-515").driver).toBeNull();
    expect(byPlate(vehicles, "QGV-374").notes).toContain("Excel: LLEVO ZIP");
    expect(byPlate(vehicles, "QGV-374").driver).toBeNull();
  });

  it("detects the Sandra block after the separator, swapped columns included", () => {
    const swift = vehicles.filter((v) => v.plate === "LNZ-709");
    expect(swift.length).toBe(2); // lower block + right block; workbook dedupes
    const lower = swift[0];
    expect(lower).toMatchObject({
      owner: { kind: "SANDRA" },
      className: "Automóvil",
      policy: { expiresOn: "2027-05-30" },
      soat: { expiresOn: "2027-05-18" },
      tecno: { notApplicable: true },
      tax: { kind: "PAID_YEAR", year: 2026 },
      driver: null,
    });
    expect(byPlate(vehicles, "PXX-516")).toMatchObject({
      owner: { kind: "SANDRA" },
      className: "Automóvil",
      policy: null,
    });
  });

  it("assigns the right-hand block to Sandra with NO UBICADO and VENDIDO sections", () => {
    // right block before the marker is a duplicate list (LNZ-709); after it: unknown owner
    const gtk = byPlate(vehicles, "GTK-274");
    expect(gtk.owner).toEqual({ kind: "UNKNOWN" });
    expect(gtk.notes).toContain("NO UBICADO PROPIETARIO");
    expect(gtk.className).toBe("Automóvil");
    expect(byPlate(vehicles, "HIK-196").owner).toEqual({ kind: "UNKNOWN" });
    expect(byPlate(vehicles, "QFR-193")).toMatchObject({
      status: "SOLD",
      className: "Campero",
      owner: { kind: "SANDRA" },
    });
    expect(byPlate(vehicles, "BTI-406")).toMatchObject({
      status: "SOLD",
      className: "Campero",
      soat: { expiresOn: "2025-09-28" },
      tecno: { expiresOn: "2025-08-28" },
    });
  });

  it("swaps plate and class when the columns are swapped in sold rows", () => {
    const kwid = byPlate(vehicles, "KCX-927");
    expect(kwid).toMatchObject({
      className: "Automóvil",
      brandLine: "RENAULT KWID",
      status: "SOLD",
      municipality: "CHIQUINQUIRA",
      sale: { buyer: "VALENTINA PAEZ (HIJA DE DON FABIAN)" },
    });
    expect(kwid.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("does not reject header or title rows", () => {
    expect(rejected.filter((r) => r.reason === "invalid_plate")).toEqual([]);
  });
});

const trailer: RawSheet = {
  name: "TRAILER",
  rows: [
    row(2, { B: "ITEMS", C: "REFERENCIA", D: "PROPIETARIO", F: "OBSERVACIONES" }),
    row(3, { A: 1, B: 1, C: "S88490 TANQUE GASOLINA", D: "TRANSPORTE EL IMPERIO", E: "FERMIN", F: "FERMIN" }),
    row(4, { A: 3, B: 3, C: "S80720", D: "FABIAN PAEZ", E: "VAGABUNDO ROJO", F: "VAGABUNDO ROJO" }),
    row(8, { A: 6, B: 6, C: "S84577", D: "FABIAN PAEZ" }),
    row(14, { A: 12, B: 12, C: "S68424", D: "FABIAN PAEZ", E: "," }),
    row(16, { A: 14, B: 14, C: "S82596", D: "BANCOLOMBIA", E: "ALBERTO CARDENAS  BANCOLOMBIA", F: "ALBERTO CARDENAS  BANCOLOMBIA" }),
    row(19, { A: 17, B: 17, C: "S91997  (R29694)", D: "TRANSPORTE EL IMPERIO", E: "MILTON", F: "SE REMATRICULO  ROJO MILTON" }),
    row(24, { B: 21, C: "R18936", D: "TRANSPASO" }),
    row(25, { B: 22, C: "R44914" }),
    row(26, { B: 23, C: "R18876", D: "VENDIDO A MIGUEL ANGEL SANTANA" }),
  ],
};

describe("parseTrailerSheet", () => {
  const { vehicles } = parseTrailerSheet(trailer, TODAY);

  it("creates Remolque vehicles with brand line from the reference", () => {
    expect(byPlate(vehicles, "S88490")).toMatchObject({
      className: "Remolque",
      brandLine: "TANQUE GASOLINA",
      owner: { kind: "IMPERIO" },
      soat: { notApplicable: true },
      tecno: { notApplicable: true },
      policy: null,
      oilChange: null,
      driver: null,
      status: "ACTIVE",
    });
    expect(byPlate(vehicles, "S88490").notes).toContain("Observaciones: FERMIN");
  });

  it("maps Fabián and third-party owners", () => {
    expect(byPlate(vehicles, "S80720").owner).toEqual({ kind: "FABIAN" });
    expect(byPlate(vehicles, "S82596").owner).toEqual({
      kind: "THIRD_PARTY",
      name: "BANCOLOMBIA",
    });
  });

  it("ignores punctuation-only observations", () => {
    expect(byPlate(vehicles, "S68424").notes).toEqual([]);
  });

  it("keeps the old plate as a note", () => {
    const v = byPlate(vehicles, "S91997");
    expect(v.notes).toContain("Placa anterior (R29694)");
    expect(v.notes).toContain("Observaciones: SE REMATRICULO ROJO MILTON");
  });

  it("handles TRANSPASO, missing owner and sold trailers", () => {
    const transpaso = byPlate(vehicles, "R18936");
    expect(transpaso.owner).toEqual({ kind: "UNKNOWN" });
    expect(transpaso.notes).toContain("Propietario: TRANSPASO");

    const noOwner = byPlate(vehicles, "R44914");
    expect(noOwner.owner).toEqual({ kind: "UNKNOWN" });
    expect(noOwner.issues.some((i) => i.field === "Propietario")).toBe(true);

    expect(byPlate(vehicles, "R18876")).toMatchObject({
      status: "SOLD",
      sale: { buyer: "MIGUEL ANGEL SANTANA" },
    });
  });
});

describe("parseWorkbook", () => {
  const result = parseWorkbook(
    [
      imperio,
      paez,
      trailer,
      { name: "VENCIMIENTOS X MES", rows: [row(1, { A: "x" })] },
    ],
    TODAY,
  );

  it("ignores unknown sheets and reports them", () => {
    expect(result.ignoredSheets).toEqual(["VENCIMIENTOS X MES"]);
    expect(result.sheets.map((s) => s.sheet)).toEqual([
      "T. IMPERIO",
      "F.PAEZ",
      "TRAILER",
    ]);
  });

  it("drops duplicated plates keeping the first (the updated Sandra block)", () => {
    const paezSheet = result.sheets[1];
    const lnz = paezSheet.vehicles.filter((v) => v.plate === "LNZ-709");
    expect(lnz).toHaveLength(1);
    expect(lnz[0].policy?.expiresOn).toBe("2027-05-30");
    const dup = paezSheet.rejected.find((r) => r.reason === "duplicate");
    expect(dup).toMatchObject({ plateText: "LNZ-709" });
    expect(dup?.issues[0].level).toBe("warning");
  });
});
