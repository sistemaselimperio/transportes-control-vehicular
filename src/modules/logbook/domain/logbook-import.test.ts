import { describe, expect, it } from "vitest";
import type { CellValue } from "@/modules/import-export/domain/cell-parsers";
import type { RawSheet } from "@/modules/import-export/domain/types";
import { EMPTY_TECHNICAL_DATA } from "@/modules/vehicles/domain/technical-data";
import {
  findPlateMismatch,
  importFileProblem,
  MAX_IMPORT_BYTES,
  parseLogbookWorkbook,
  planLogbookImport,
  previewOf,
  type ExistingRecords,
  type LogbookImport,
} from "./logbook-import";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** In-memory sheet: `[rowNumber, cells]` pairs, like the xlsx reader returns them. */
const sheet = (name: string, rows: Array<[number, Record<string, CellValue>]>): RawSheet => ({
  name,
  rows: rows.map(([rowNumber, cells]) => ({ rowNumber, cells })),
});

const EMPTY: LogbookImport = { plates: [], services: [], technical: {}, issues: [] };
const NO_EXISTING: ExistingRecords = { services: [] };
const CTX = { today: "2026-10-27" };

/* ----------------------------- Mantenimiento ----------------------------- */

const maintenanceSheet = (rows: Array<[number, Record<string, CellValue>]>) =>
  sheet("MANTENIMIENTO", [
    [4, { B: "MARCA", F: "PLACA:", G: "WOM-158" }],
    [7, { B: "FECHA", C: "DESCRIPCION DEL MANTENIMIENTO", E: "PROVEEDOR", F: "PRECIO", G: "NOVEDAD" }],
    ...rows,
  ]);

describe("parseLogbookWorkbook: MANTENIMIENTO", () => {
  it("maps date, description, provider, price and the note", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([
        [8, { B: day(2026, 2, 13), C: "SERVICIO LAVADO GENERAL", E: "LICETH OCHOA 1098787088", F: 140000, G: "revisar" }],
      ]),
    ]);
    expect(result.services).toEqual([
      {
        row: 8,
        date: "2026-02-13",
        description: "SERVICIO LAVADO GENERAL",
        provider: "LICETH OCHOA 1098787088",
        km: null,
        price: 140000,
        notes: "revisar",
      },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("finds the columns by their header, whatever their order", () => {
    const result = parseLogbookWorkbook([
      sheet("MANTENIMIENTO", [
        [7, { B: "FECHA", C: "DESCRIPCION", D: "DESCRIPCION", E: "PROVEEDOR", F: "KILOMETRAJE", G: "PRECIO", H: "NOVEDAD" }],
        [8, { B: day(2025, 7, 10), C: "JGO FRENO", D: "JGO FRENO", E: "FREDY", F: 259548, G: 540000, H: "RECIBO" }],
        [9, { B: day(2025, 10, 15), C: "REVISION REVERSO", E: "AZAEL", F: "TRILER S769715", G: 36000 }],
      ]),
    ]);
    expect(result.services.map(({ km, price, notes }) => ({ km, price, notes }))).toEqual([
      { km: 259548, price: 540000, notes: "RECIBO" },
      { km: null, price: 36000, notes: "TRILER S769715" },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("reads dates written as text in any usual format", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([
        [8, { B: "16--10-2025", C: "A" }],
        [9, { B: "5-8-25", C: "B" }],
        [10, { B: "05.08.2025", C: "C" }],
        [11, { B: "2025/8/5", C: "D" }],
        [12, { B: 45874, C: "E" }],
        [13, { B: " 5 / 8 / 2025 ", C: "F" }],
      ]),
    ]);
    expect(result.services.map((s) => s.date)).toEqual([
      "2025-10-16",
      "2025-08-05",
      "2025-08-05",
      "2025-08-05",
      "2025-08-05",
      "2025-08-05",
    ]);
    expect(result.issues).toEqual([]);
  });

  it("takes the year of the row above when the year has a typo", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([
        [15, { B: day(2025, 8, 9), C: "LAVADA" }],
        [16, { B: "05-08-205", C: "ENGRASE" }],
      ]),
    ]);
    expect(result.services.map((s) => s.date)).toEqual(["2025-08-09", "2025-08-05"]);
    expect(result.issues).toEqual([]);
  });

  it("keeps a bare-number provider as text and an empty price as null", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([[9, { B: day(2026, 3, 10), C: "SERVICIO ENGRASE", E: 91455007 }]]),
    ]);
    expect(result.services[0]).toMatchObject({ provider: "91455007", price: null, notes: null });
  });

  it("collapses whitespace and newlines in the description", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([[9, { B: day(2026, 3, 10), C: "UNO  DOS\nTRES " }]]),
    ]);
    expect(result.services[0].description).toBe("UNO DOS TRES");
  });

  it("skips a row without date with an issue", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([[35, { C: "PRESTARON LA VALVULA DE PRESION" }]]),
    ]);
    expect(result.services).toEqual([]);
    expect(result.issues).toEqual([{ tab: "servicios", row: 35, message: "Sin fecha." }]);
  });

  it("skips a row with an unreadable date and says why", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([
        [84, { B: "AYER", C: "SUMINISTRO FILTRO", F: 109000 }],
        [85, { B: "31/02/2026", C: "SUMINISTRO FILTRO", F: 109000 }],
      ]),
    ]);
    expect(result.services).toEqual([]);
    expect(result.issues.map((i) => [i.tab, i.row])).toEqual([
      ["servicios", 84],
      ["servicios", 85],
    ]);
    expect(result.issues[0].message).toContain("AYER");
    expect(result.issues[1].message).toContain("31/02/2026");
  });

  it("skips a dated row without description", () => {
    const result = parseLogbookWorkbook([maintenanceSheet([[10, { B: day(2026, 3, 10), F: 5000 }]])]);
    expect(result.services).toEqual([]);
    expect(result.issues).toEqual([{ tab: "servicios", row: 10, message: "Sin descripción." }]);
  });

  it("skips a row with an unreadable price", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([[10, { B: day(2026, 3, 10), C: "ALGO", F: "mucho" }]]),
    ]);
    expect(result.services).toEqual([]);
    expect(result.issues[0]).toMatchObject({ row: 10, message: 'Precio no válido: "mucho".' });
  });

  it("silently ignores totals and rows without date nor description", () => {
    const result = parseLogbookWorkbook([maintenanceSheet([[89, { F: 22941142 }]])]);
    expect(result).toMatchObject({ services: [], issues: [] });
  });

  it("reads thousands separators in a text price", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([[10, { B: day(2026, 3, 10), C: "ALGO", F: "1.423.000" }]]),
    ]);
    expect(result.services[0].price).toBe(1423000);
  });
});

/* ------------------------ Sheets that are not imported ------------------------ */

describe("parseLogbookWorkbook: ACEITE, LLANTAS and COMBUSTIBLE", () => {
  it("ignores them entirely: no records and no issues, though they still feed the plate check", () => {
    const result = parseLogbookWorkbook([
      sheet("ACEITE", [
        [4, { B: "PLACA ", C: "WOM-158" }],
        [14, { B: "FECHA", C: day(2025, 6, 13) }],
        [16, { B: "KILOMETRAJE", C: 407279 }],
        [19, { B: "CANTIDAD", C: "DETALLE" }],
        [20, { B: "48 CUARTOS", C: "DELO 15W40" }],
        [26, { B: "FECHA", C: "ayer" }],
      ]),
      sheet("LLANTAS", [
        [15, { B: "FECHA", C: day(2025, 7, 17) }],
        [18, { B: "CANTIDAD", C: "DETALLE" }],
        [19, { B: 2, C: "LLANTA 295 80 22,5" }],
        [20, { C: "LLANTA SIN CANTIDAD" }],
      ]),
      sheet("COMBUSTIBLE", [
        [6, { B: "FECHA", C: "CANTIDAD", D: "VALOR" }],
        [7, { B: day(2025, 7, 13), C: 100, D: 935000 }],
        [8, { B: day(2025, 7, 14), C: 30, D: "abc" }],
      ]),
    ]);
    expect(result).toEqual({ ...EMPTY, plates: ["WOM-158"] });
  });
});


/* ------------------------- names, labels and plates ------------------------- */

describe("parseLogbookWorkbook: names and plates", () => {
  it("matches sheet names ignoring case, accents and trailing spaces, and label cells too", () => {
    const result = parseLogbookWorkbook([
      sheet("Mantenimiento ", [
        [7, { B: " fecha ", C: "Descripción" }],
        [8, { B: day(2025, 7, 13), C: "LAVADO" }],
      ]),
      sheet("datos generales", [[6, { B: "modelo:", C: 2023 }]]),
    ], CTX);
    expect(result.services).toHaveLength(1);
    expect(result.technical).toEqual({ modelYear: 2023 });
  });

  it("ignores unknown sheets", () => {
    const result = parseLogbookWorkbook([sheet("OTRA", [[1, { B: "FECHA", C: day(2025, 1, 1) }]])]);
    expect(result).toEqual(EMPTY);
  });

  it("collects the plate from labeled cells of every sheet, normalized and without repeats", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([]),
      sheet("DATOS GENERALES ", [[3, { B: "PLACA ", C: "wom 158" }]]),
      sheet("ACEITE", [[4, { B: "PLACA ", C: "WOM-158" }]]),
    ]);
    expect(result.plates).toEqual(["WOM-158"]);
  });
});

/* ------------------------------ DATOS GENERALES ------------------------------ */

const TECH_CTX = { today: "2026-10-27" };

const generalSheet = (rows: Array<[number, Record<string, CellValue>]>) => sheet("DATOS GENERALES", rows);

describe("parseLogbookWorkbook: DATOS GENERALES", () => {
  it("reads the real file's technical rows and ignores the other labels", () => {
    const result = parseLogbookWorkbook(
      [
        generalSheet([
          [2, { B: "VEHICULO", C: "TRACTOCAMION" }],
          [3, { B: "PLACA", C: "JVK-590" }],
          [4, { B: "PROPIETARIO", C: "ACME" }],
          [5, { B: "FECHA DE MATRICULA ", C: day(2022, 5, 13) }],
          [6, { B: "MODELO:", C: 2023 }],
          [7, { B: "LINEA", C: "T800" }],
          [8, { B: "NUMERO DE MOTOR", C: 80392200 }],
          [9, { B: "NUMERO DE CHASIS", C: 731087 }],
          [10, { B: "Número de serie", C: 731087 }],
          [11, { B: "TIPO CARROCERIA", C: " SRS " }],
          [12, { B: "CAPACIDAD" }],
          [13, { B: "CILINDRAJE", C: 14900 }],
          [14, { B: "COLOR", C: "AZUL TROPICAL" }],
          [15, { B: "MARCA", C: "KENWORTH" }],
          [16, { B: "SOAT", C: day(2026, 1, 1), D: "obs" }],
        ]),
      ],
      TECH_CTX,
    );
    expect(result.technical).toEqual({
      registrationDate: "2022-05-13",
      modelYear: 2023,
      engineNumber: "80392200",
      chassisNumber: "731087",
      serialNumber: "731087",
      bodyType: "SRS",
      engineDisplacement: 14900,
      color: "AZUL TROPICAL",
    });
    expect(result.issues).toEqual([]);
  });

  it("reads fuel, capacity, weight and the alternative body type label", () => {
    const result = parseLogbookWorkbook(
      [
        generalSheet([
          [1, { B: "TIPO DE CARROCERIA", C: "FURGON" }],
          [2, { B: "COMBUSTIBLE", C: "DIESEL" }],
          [3, { B: "CAPACIDAD", C: "34 t" }],
          [4, { B: "PESO BRUTO", C: "52.000" }],
        ]),
      ],
      TECH_CTX,
    );
    expect(result.technical).toEqual({
      bodyType: "FURGON",
      fuelType: "DIESEL",
      capacity: "34 t",
      grossWeightKg: 52000,
    });
    const peso = parseLogbookWorkbook([generalSheet([[1, { B: "PESO", C: 8000 }]])], TECH_CTX);
    expect(peso.technical).toEqual({ grossWeightKg: 8000 });
  });

  it("accepts the registration date as an Excel serial or as text", () => {
    const serial = parseLogbookWorkbook([generalSheet([[1, { B: "FECHA DE MATRICULA", C: 44694 }]])], TECH_CTX);
    expect(serial.technical.registrationDate).toBe("2022-05-13");
    const text = parseLogbookWorkbook([generalSheet([[1, { B: "FECHA DE MATRICULA", C: "13/05/2022" }]])], TECH_CTX);
    expect(text.technical.registrationDate).toBe("2022-05-13");
  });

  it("skips an invalid model year or date with an issue and keeps the rest", () => {
    const result = parseLogbookWorkbook(
      [
        generalSheet([
          [6, { B: "MODELO", C: 1900 }],
          [7, { B: "FECHA DE MATRICULA", C: "ayer" }],
          [8, { B: "COLOR", C: "ROJO" }],
        ]),
      ],
      TECH_CTX,
    );
    expect(result.technical).toEqual({ color: "ROJO" });
    expect(result.issues.map((i) => [i.tab, i.row])).toEqual([
      ["datos", 6],
      ["datos", 7],
    ]);
    expect(result.issues[0].message).toMatch(/modelo/i);
  });

  it("does nothing without the sheet", () => {
    expect(parseLogbookWorkbook([maintenanceSheet([])], TECH_CTX).technical).toEqual({});
  });
});

describe("findPlateMismatch", () => {
  it("accepts the same plate however it is written", () => {
    expect(findPlateMismatch(["WOM-158"], "wom158")).toBeNull();
    expect(findPlateMismatch(["WOM-158"], "WOM-158")).toBeNull();
  });

  it("rejects a file without any plate", () => {
    expect(findPlateMismatch([], "WOM-158")).toMatch(/placa/i);
  });

  it("rejects a different plate and names both", () => {
    const message = findPlateMismatch(["ABC-123"], "WOM-158");
    expect(message).toContain("ABC-123");
    expect(message).toContain("WOM-158");
  });

  it("rejects a file that mixes plates", () => {
    expect(findPlateMismatch(["WOM-158", "ABC-123"], "WOM-158")).toContain("ABC-123");
  });
});

describe("importFileProblem", () => {
  it("accepts a non-empty .xlsx up to the limit, whatever the case", () => {
    expect(importFileProblem({ name: "BITACORA WOM-158.xlsx", size: 1000 })).toBeNull();
    expect(importFileProblem({ name: "bitacora.XLSX", size: MAX_IMPORT_BYTES })).toBeNull();
  });

  it("rejects other extensions, empty files and files over the limit", () => {
    expect(importFileProblem({ name: "bitacora.xls", size: 1000 })).toMatch(/xlsx/);
    expect(importFileProblem({ name: "bitacora.xlsx", size: 0 })).toMatch(/vacío/);
    expect(importFileProblem({ name: "bitacora.xlsx", size: MAX_IMPORT_BYTES + 1 })).toMatch(/grande/);
  });
});

/* --------------------------------- Planning --------------------------------- */

const service = (date: string, description: string, price: number | null, row = 8) => ({
  row,
  date,
  description,
  provider: null,
  km: null,
  price,
  notes: null,
});

describe("planLogbookImport", () => {
  it("keeps new rows and counts them", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-02-13", "LAVADO", 140000)] };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.services).toHaveLength(1);
    expect(plan.counts).toEqual({ create: 1, duplicates: 0, skipped: 0 });
  });

  it("skips services that already exist (same date, description ignoring case/accents/spaces, price)", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-02-13", "Lavado  General", 140000)] };
    const existing: ExistingRecords = {
      ...NO_EXISTING,
      services: [{ date: "2026-02-13", description: "LAVADO GENERAL", price: 140000 }],
    };
    const plan = planLogbookImport(parsed, existing, CTX);
    expect(plan.services).toEqual([]);
    expect(plan.counts.duplicates).toBe(1);
  });

  it("treats a different price as a different service", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-02-13", "LAVADO", 150000)] };
    const existing: ExistingRecords = {
      ...NO_EXISTING,
      services: [{ date: "2026-02-13", description: "LAVADO", price: 140000 }],
    };
    expect(planLogbookImport(parsed, existing, CTX).services).toHaveLength(1);
  });

  it("dedupes identical rows inside the file, keeping the first", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-02-13", "LAVADO", 140000, 8), service("2026-02-13", "lavado", 140000, 9)],
    };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.services.map((s) => s.row)).toEqual([8]);
    expect(plan.counts.duplicates).toBe(1);
  });

  it("is idempotent: planning what was just created again creates nothing", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-02-13", "LAVADO", 140000)] };
    const first = planLogbookImport(parsed, NO_EXISTING, CTX);
    const existing: ExistingRecords = {
      services: first.services.map((s) => ({ date: s.date, description: s.description, price: s.price })),
    };
    expect(planLogbookImport(parsed, existing, CTX).services).toEqual([]);
  });

  it("skips future dates with a reason", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-10-28", "LAVADO", 1)] };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.services).toEqual([]);
    expect(plan.skipped.map((s) => [s.tab, s.row, s.message])).toEqual([
      ["servicios", 8, "Fecha futura (28/10/2026)."],
    ]);
    expect(plan.counts.skipped).toBe(1);
  });

  it("accepts today's date", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-10-27", "LAVADO", 1)] };
    expect(planLogbookImport(parsed, NO_EXISTING, CTX).services).toHaveLength(1);
  });

  it("carries the parse issues into the skipped list and counts, ordered by tab and row, general data last", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      issues: [
        { tab: "datos", row: 6, message: "Modelo no válido." },
        { tab: "servicios", row: 35, message: "Sin fecha." },
        { tab: "servicios", row: 9, message: "Sin descripción." },
      ],
    };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.skipped.map((s) => [s.tab, s.row])).toEqual([
      ["servicios", 9],
      ["servicios", 35],
      ["datos", 6],
    ]);
    expect(plan.counts.skipped).toBe(2);
  });
});

describe("planLogbookImport: technical data", () => {
  const parsed: LogbookImport = {
    ...EMPTY,
    technical: { modelYear: 2023, color: "AZUL", engineDisplacement: 14900 },
  };

  it("fills the fields the vehicle has empty", () => {
    const plan = planLogbookImport(parsed, { ...NO_EXISTING, technical: { ...EMPTY_TECHNICAL_DATA } }, CTX);
    expect(plan.technical).toEqual({ modelYear: 2023, color: "AZUL", engineDisplacement: 14900 });
  });

  it("never overwrites a value the vehicle already has", () => {
    const plan = planLogbookImport(parsed, { ...NO_EXISTING, technical: { ...EMPTY_TECHNICAL_DATA, color: "ROJO" } }, CTX);
    expect(plan.technical).toEqual({ modelYear: 2023, engineDisplacement: 14900 });
  });

  it("is idempotent: nothing to fill once the vehicle has the data", () => {
    const first = planLogbookImport(parsed, { ...NO_EXISTING, technical: { ...EMPTY_TECHNICAL_DATA } }, CTX);
    const second = planLogbookImport(parsed, { ...NO_EXISTING, technical: { ...EMPTY_TECHNICAL_DATA, ...first.technical } }, CTX);
    expect(second.technical).toEqual({});
  });

  it("counts the fields in the preview total and lists their labels", () => {
    const preview = previewOf(planLogbookImport(parsed, { ...NO_EXISTING, technical: { ...EMPTY_TECHNICAL_DATA } }, CTX), "WOM-158");
    expect(preview.technical.labels).toEqual(["Modelo", "Cilindraje", "Color"]);
    expect(preview.technical.count).toBe(3);
    expect(preview.total).toBe(3);
  });

  it("counts a skipped general-data issue apart from the services", () => {
    const withIssue: LogbookImport = { ...EMPTY, issues: [{ tab: "datos", row: 6, message: "Modelo no válido." }] };
    const plan = planLogbookImport(withIssue, NO_EXISTING, CTX);
    expect(plan.skipped).toHaveLength(1);
    expect(previewOf(plan, "WOM-158").technical.skipped).toBe(1);
    expect(plan.counts.skipped).toBe(0);
  });
});

describe("previewOf", () => {
  it("gives the service counts and the total to create", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-02-13", "LAVADO", 140000), service("2026-02-14", "ENGRASE", 1)],
    };
    const preview = previewOf(planLogbookImport(parsed, NO_EXISTING, CTX), "WOM-158");
    expect(preview.plate).toBe("WOM-158");
    expect(preview.total).toBe(2);
    expect(preview.services).toEqual({ create: 2, duplicates: 0, skipped: 0 });
  });
});
