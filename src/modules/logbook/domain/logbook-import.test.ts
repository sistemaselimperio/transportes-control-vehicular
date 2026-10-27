import { describe, expect, it } from "vitest";
import type { CellValue } from "@/modules/import-export/domain/cell-parsers";
import type { RawSheet } from "@/modules/import-export/domain/types";
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

const EMPTY: LogbookImport = { plates: [], services: [], oils: [], tires: [], fuels: [], issues: [] };
const NO_EXISTING: ExistingRecords = { services: [], fuels: [], tires: [], oilDates: [] };
const CTX = { today: "2026-10-27", odometerWorking: true };

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
        price: 140000,
        notes: "revisar",
      },
    ]);
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
      maintenanceSheet([[84, { B: "16--10-2026", C: "SUMINISTRO FILTRO", F: 109000 }]]),
    ]);
    expect(result.services).toEqual([]);
    expect(result.issues[0]).toMatchObject({ tab: "servicios", row: 84 });
    expect(result.issues[0].message).toContain("16--10-2026");
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

/* -------------------------------- Aceite -------------------------------- */

const oilTemplate: Array<[number, Record<string, CellValue>]> = [
  [3, { B: "LISTA DE FILTRO Y ACEITE PARA EL CAMBIO" }],
  [4, { B: "PLACA ", C: "WOM-158" }],
  [6, { B: "CANTIDAD", C: "DETALLE" }],
  [7, { B: "48 CUARTOS", C: "DELO 15W40" }],
  [8, { C: "FITRO ACEITE FL 14000 NN" }],
];

const oilBlock = (
  start: number,
  date: Date | null,
  km: number | null,
  items: Array<Record<string, CellValue>>,
): Array<[number, Record<string, CellValue>]> => [
  [start, date ? { B: "FECHA", C: date } : { B: "FECHA" }],
  [start + 1, { B: "PLACA ", C: "WOM-158" }],
  [start + 2, km === null ? { B: "KILOMETRAJE" } : { B: "KILOMETRAJE", C: km }],
  [start + 3, { B: "PROXIMO CAMBIO", C: 427279 }],
  [start + 4, { B: "CONDUCTOR", C: "FREDY MORALES " }],
  [start + 5, { B: "CANTIDAD", C: "DETALLE", D: "OBSERVACIONES" }],
  ...items.map((cells, i): [number, Record<string, CellValue>] => [start + 6 + i, cells]),
];

describe("parseLogbookWorkbook: ACEITE", () => {
  it("parses a block into one oil change with its items", () => {
    const result = parseLogbookWorkbook([
      sheet("ACEITE", [
        ...oilTemplate,
        ...oilBlock(14, day(2025, 6, 13), 407279, [
          { B: "48 CUARTOS", C: "DELO 15W40" },
          { B: 1, C: "FITRO ACEITE FL 14000 NN" },
        ]),
      ]),
    ]);
    expect(result.oils).toEqual([
      {
        row: 14,
        date: "2025-06-13",
        km: 407279,
        items: [
          { quantity: 48, detail: "CUARTOS DELO 15W40" },
          { quantity: 1, detail: "FITRO ACEITE FL 14000 NN" },
        ],
        notes: null,
      },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("ignores the template list above the first FECHA", () => {
    const result = parseLogbookWorkbook([sheet("ACEITE", oilTemplate)]);
    expect(result).toMatchObject({ oils: [], issues: [] });
  });

  it("defaults the quantity of a line without one to 1 and joins distinct observations in the notes", () => {
    const result = parseLogbookWorkbook([
      sheet(
        "ACEITE",
        oilBlock(38, day(2025, 12, 8), 448693, [
          { B: "48 CUARTOS", C: "DELO 15W40", D: "LUB563" },
          { C: "FILTRO AS2474 TRANSMICION", D: "LUB563" },
          { B: 1, C: "FILTRO COMBUSTIBLE", D: "CAMBIO INTERMEDIO " },
        ]),
      ),
    ]);
    expect(result.oils[0].items[1]).toEqual({ quantity: 1, detail: "FILTRO AS2474 TRANSMICION" });
    expect(result.oils[0].notes).toBe("LUB563; CAMBIO INTERMEDIO");
  });

  it("keeps a block without km (km null)", () => {
    const result = parseLogbookWorkbook([
      sheet("ACEITE", oilBlock(26, day(2025, 9, 11), null, [{ B: 1, C: "FILTRO" }])),
    ]);
    expect(result.oils[0]).toMatchObject({ date: "2025-09-11", km: null });
  });

  it("silently skips a block without date and without items", () => {
    const result = parseLogbookWorkbook([sheet("ACEITE", oilBlock(26, null, null, []))]);
    expect(result).toMatchObject({ oils: [], issues: [] });
  });

  it("reports a block without date that has items", () => {
    const result = parseLogbookWorkbook([sheet("ACEITE", oilBlock(26, null, null, [{ B: 1, C: "FILTRO" }]))]);
    expect(result.oils).toEqual([]);
    expect(result.issues).toEqual([{ tab: "aceite", row: 26, message: "Bloque sin fecha." }]);
  });

  it("ends the items at a blank row and splits consecutive blocks", () => {
    const result = parseLogbookWorkbook([
      sheet("ACEITE", [
        ...oilBlock(14, day(2025, 6, 13), 1000, [{ B: 1, C: "A" }, { B: 1, C: "B" }]),
        // row 22 is blank; the stray row 23 does not belong to the first block
        [23, { C: "SUELTO" }],
        ...oilBlock(26, day(2025, 9, 11), 2000, [{ B: 2, C: "C" }]),
      ]),
    ]);
    expect(result.oils.map((o) => [o.date, o.items.map((i) => i.detail)])).toEqual([
      ["2025-06-13", ["A", "B"]],
      ["2025-09-11", ["C"]],
    ]);
  });

  it("reports a block with an unreadable date", () => {
    const result = parseLogbookWorkbook([
      sheet("ACEITE", oilBlock(14, null, null, []).map((r, i) => (i === 0 ? ([14, { B: "FECHA", C: "ayer" }] as [number, Record<string, CellValue>]) : r))),
    ]);
    expect(result.oils).toEqual([]);
    expect(result.issues[0]).toMatchObject({ tab: "aceite", row: 14 });
    expect(result.issues[0].message).toContain("ayer");
  });
});

/* ------------------------------ Combustible ------------------------------ */

const fuelHeader: [number, Record<string, CellValue>] = [
  6,
  { B: "FECHA", C: "CANTIDAD", D: "VALOR", E: "PROVEEDOR" },
];

describe("parseLogbookWorkbook: COMBUSTIBLE", () => {
  it("maps gallons, amount and provider and ignores the month total", () => {
    const result = parseLogbookWorkbook([
      sheet("COMBUSTIBLE", [
        [5, { B: "MES ", C: "JULIO 2025" }],
        fuelHeader,
        [7, { B: day(2025, 7, 13), C: 100, D: 935000, E: "EDS NEW EL ROSARIO TRESGES" }],
        [22, { C: "TOTAL MES", D: 935000 }],
      ]),
    ]);
    expect(result.fuels).toEqual([
      { row: 7, date: "2025-07-13", gallons: 100, amount: 935000, provider: "EDS NEW EL ROSARIO TRESGES" },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("handles repeated month blocks with their own headers", () => {
    const result = parseLogbookWorkbook([
      sheet("COMBUSTIBLE", [
        [5, { B: "MES ", C: "JULIO 2025" }],
        fuelHeader,
        [7, { B: day(2025, 7, 13), C: 50, D: 400000 }],
        [8, { C: "TOTAL MES", D: 400000 }],
        [10, { B: "MES ", C: "AGOSTO 2025" }],
        [11, { B: "FECHA", C: "CANTIDAD", D: "VALOR", E: "PROVEEDOR" }],
        [12, { B: day(2025, 8, 2), C: "45,5", D: 410000 }],
        [13, { C: "TOTAL MES", D: 410000 }],
      ]),
    ]);
    expect(result.fuels.map((f) => [f.date, f.gallons])).toEqual([
      ["2025-07-13", 50],
      ["2025-08-02", 45.5],
    ]);
    expect(result.issues).toEqual([]);
  });

  it("skips a fill without value", () => {
    const result = parseLogbookWorkbook([sheet("COMBUSTIBLE", [fuelHeader, [7, { B: day(2025, 7, 13), C: 30 }]])]);
    expect(result.fuels).toEqual([]);
    expect(result.issues).toEqual([{ tab: "combustible", row: 7, message: "Sin valor." }]);
  });

  it("skips a fill without date or without quantity", () => {
    const result = parseLogbookWorkbook([
      sheet("COMBUSTIBLE", [fuelHeader, [7, { C: 30, D: 100000 }], [8, { B: day(2025, 7, 13), D: 100000 }]]),
    ]);
    expect(result.fuels).toEqual([]);
    expect(result.issues.map((i) => [i.row, i.message])).toEqual([
      [7, "Sin fecha."],
      [8, "Sin cantidad."],
    ]);
  });

  it("ignores rows before the first header", () => {
    const result = parseLogbookWorkbook([sheet("COMBUSTIBLE", [[3, { B: "PLACA ", C: "WOM-158" }]])]);
    expect(result).toMatchObject({ fuels: [], issues: [] });
  });
});

/* -------------------------------- Llantas -------------------------------- */

describe("parseLogbookWorkbook: LLANTAS", () => {
  const template: Array<[number, Record<string, CellValue>]> = [
    [3, { B: "PLACA ", C: "WOM-158" }],
    [5, { B: "CANTIDAD", C: "DETALLE" }],
    [6, { C: "LLANTA 295 80 22,5 DEOUBLECOIN RT606 DEL" }],
  ];

  it("creates one tire row per item line, with the observation as note (plate in column D)", () => {
    const result = parseLogbookWorkbook([
      sheet("LLANTAS", [
        ...template,
        [15, { B: "FECHA", C: day(2025, 7, 17) }],
        [16, { B: "PLACA ", D: "WOM-158" }],
        [18, { B: "CANTIDAD", C: "DETALLE", D: "OBSERVACION" }],
        [19, { B: 2, C: "LLANTA 295 80 22,5 DEOUBLECOIN RT606 DEL", D: "PENDIENTE LAS FOTOS " }],
        [20, { B: 4, C: "LLANTA 11R22.5" }],
      ]),
    ]);
    expect(result.tires).toEqual([
      { row: 19, date: "2025-07-17", quantity: 2, reference: "LLANTA 295 80 22,5 DEOUBLECOIN RT606 DEL", price: null, notes: "PENDIENTE LAS FOTOS" },
      { row: 20, date: "2025-07-17", quantity: 4, reference: "LLANTA 11R22.5", price: null, notes: null },
    ]);
    expect(result.plates).toEqual(["WOM-158"]);
  });

  it("reads the price when the fourth column header is VALOR", () => {
    const result = parseLogbookWorkbook([
      sheet("LLANTAS", [
        [43, { B: "FECHA", C: day(2026, 1, 5) }],
        [48, { B: "CANTIDAD", C: "DETALLE", D: "VALOR" }],
        [49, { B: 2, C: "LLANTA X", D: 1800000 }],
      ]),
    ]);
    expect(result.tires[0]).toMatchObject({ price: 1800000, notes: null });
  });

  it("ignores the template and blocks without date", () => {
    const result = parseLogbookWorkbook([
      sheet("LLANTAS", [
        ...template,
        [28, { B: "FECHA" }],
        [29, { B: "PLACA ", C: "CAMION KODIAK" }],
        [33, { B: "CANTIDAD", C: "DETALLE", D: "OBSERVACION" }],
      ]),
    ]);
    expect(result).toMatchObject({ tires: [], issues: [] });
    expect(result.plates).toEqual(["WOM-158"]); // "CAMION KODIAK" is not a plate
  });

  it("skips lines without quantity or reference", () => {
    const result = parseLogbookWorkbook([
      sheet("LLANTAS", [
        [15, { B: "FECHA", C: day(2025, 7, 17) }],
        [18, { B: "CANTIDAD", C: "DETALLE", D: "OBSERVACION" }],
        [19, { C: "LLANTA SIN CANTIDAD" }],
        [20, { B: 2, D: "solo observacion" }],
      ]),
    ]);
    expect(result.tires).toEqual([]);
    expect(result.issues.map((i) => [i.tab, i.row, i.message])).toEqual([
      ["llantas", 19, "Sin cantidad."],
      ["llantas", 20, "Sin detalle."],
    ]);
  });
});

/* ------------------------- names, labels and plates ------------------------- */

describe("parseLogbookWorkbook: names and plates", () => {
  it("matches sheet names ignoring case, accents and trailing spaces, and label cells too", () => {
    const result = parseLogbookWorkbook([
      sheet("Combustible ", [
        [6, { B: " fecha ", C: "Cantidad", D: "Valor" }],
        [7, { B: day(2025, 7, 13), C: 10, D: 90000 }],
      ]),
      sheet("aceite", oilBlock(14, day(2025, 6, 13), 1000, [{ B: 1, C: "FILTRO" }]).map(([n, c]) => [n, { ...c, B: typeof c.B === "string" ? c.B.toLowerCase() : c.B }] as [number, Record<string, CellValue>])),
    ]);
    expect(result.fuels).toHaveLength(1);
    expect(result.oils).toHaveLength(1);
  });

  it("ignores unknown sheets", () => {
    const result = parseLogbookWorkbook([sheet("OTRA", [[1, { B: "FECHA", C: day(2025, 1, 1) }]])]);
    expect(result).toEqual(EMPTY);
  });

  it("collects the plate from labeled cells of every sheet, normalized and without repeats", () => {
    const result = parseLogbookWorkbook([
      maintenanceSheet([]),
      sheet("DATOS GENERALES ", [[3, { B: "PLACA ", C: "wom 158" }]]),
      sheet("ACEITE", oilTemplate),
    ]);
    expect(result.plates).toEqual(["WOM-158"]);
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
  price,
  notes: null,
});

describe("planLogbookImport", () => {
  it("keeps new rows and counts them per tab", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-02-13", "LAVADO", 140000)],
      fuels: [{ row: 7, date: "2025-07-13", gallons: 100, amount: 935000, provider: null }],
    };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.services).toHaveLength(1);
    expect(plan.fuels).toHaveLength(1);
    expect(plan.counts.servicios).toEqual({ create: 1, duplicates: 0, skipped: 0 });
    expect(plan.counts.combustible).toEqual({ create: 1, duplicates: 0, skipped: 0 });
    expect(plan.counts.aceite).toEqual({ create: 0, duplicates: 0, skipped: 0 });
  });

  it("skips services that already exist (same date, description ignoring case/accents/spaces, price)", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-02-13", "Lavado  General", 140000)] };
    const existing: ExistingRecords = {
      ...NO_EXISTING,
      services: [{ date: "2026-02-13", description: "LAVADO GENERAL", price: 140000 }],
    };
    const plan = planLogbookImport(parsed, existing, CTX);
    expect(plan.services).toEqual([]);
    expect(plan.counts.servicios.duplicates).toBe(1);
  });

  it("treats a different price as a different service", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-02-13", "LAVADO", 150000)] };
    const existing: ExistingRecords = {
      ...NO_EXISTING,
      services: [{ date: "2026-02-13", description: "LAVADO", price: 140000 }],
    };
    expect(planLogbookImport(parsed, existing, CTX).services).toHaveLength(1);
  });

  it("skips fuel and tires that already exist", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      fuels: [{ row: 7, date: "2025-07-13", gallons: 100, amount: 935000, provider: null }],
      tires: [{ row: 19, date: "2025-07-17", quantity: 2, reference: "Llanta X", price: null, notes: null }],
    };
    const existing: ExistingRecords = {
      ...NO_EXISTING,
      fuels: [{ date: "2025-07-13", gallons: 100, amount: 935000 }],
      tires: [{ date: "2025-07-17", quantity: 2, reference: "LLANTA X" }],
    };
    const plan = planLogbookImport(parsed, existing, CTX);
    expect(plan.fuels).toEqual([]);
    expect(plan.tires).toEqual([]);
    expect(plan.counts.combustible.duplicates).toBe(1);
    expect(plan.counts.llantas.duplicates).toBe(1);
  });

  it("skips an oil change on a date that already has one", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      oils: [{ row: 14, date: "2025-06-13", km: 1000, items: [], notes: null }],
    };
    const plan = planLogbookImport(parsed, { ...NO_EXISTING, oilDates: ["2025-06-13"] }, CTX);
    expect(plan.oils).toEqual([]);
    expect(plan.counts.aceite.duplicates).toBe(1);
  });

  it("dedupes identical rows inside the file, keeping the first", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-02-13", "LAVADO", 140000, 8), service("2026-02-13", "lavado", 140000, 9)],
      oils: [
        { row: 14, date: "2025-06-13", km: 1000, items: [], notes: null },
        { row: 26, date: "2025-06-13", km: 1000, items: [], notes: null },
      ],
    };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.services.map((s) => s.row)).toEqual([8]);
    expect(plan.oils.map((o) => o.row)).toEqual([14]);
    expect(plan.counts.servicios.duplicates).toBe(1);
    expect(plan.counts.aceite.duplicates).toBe(1);
  });

  it("is idempotent: planning what was just created again creates nothing", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-02-13", "LAVADO", 140000)],
      fuels: [{ row: 7, date: "2025-07-13", gallons: 45.5, amount: 410000, provider: null }],
      tires: [{ row: 19, date: "2025-07-17", quantity: 2, reference: "LLANTA", price: null, notes: null }],
      oils: [{ row: 14, date: "2025-06-13", km: 1000, items: [], notes: null }],
    };
    const first = planLogbookImport(parsed, NO_EXISTING, CTX);
    const existing: ExistingRecords = {
      services: first.services.map((s) => ({ date: s.date, description: s.description, price: s.price })),
      fuels: first.fuels.map((f) => ({ date: f.date, gallons: f.gallons, amount: f.amount })),
      tires: first.tires.map((t) => ({ date: t.date, quantity: t.quantity, reference: t.reference })),
      oilDates: first.oils.map((o) => o.date),
    };
    const second = planLogbookImport(parsed, existing, CTX);
    expect([second.services, second.fuels, second.tires, second.oils].flat()).toEqual([]);
  });

  it("skips future dates with a reason", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-10-28", "LAVADO", 1)],
      oils: [{ row: 14, date: "2027-01-01", km: 1000, items: [], notes: null }],
    };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.services).toEqual([]);
    expect(plan.oils).toEqual([]);
    expect(plan.skipped.map((s) => [s.tab, s.row, s.message])).toEqual([
      ["servicios", 8, "Fecha futura (28/10/2026)."],
      ["aceite", 14, "Fecha futura (01/01/2027)."],
    ]);
    expect(plan.counts.servicios.skipped).toBe(1);
  });

  it("accepts today's date", () => {
    const parsed: LogbookImport = { ...EMPTY, services: [service("2026-10-27", "LAVADO", 1)] };
    expect(planLogbookImport(parsed, NO_EXISTING, CTX).services).toHaveLength(1);
  });

  it("skips an oil change without km when the odometer works, but not when it is broken", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      oils: [{ row: 26, date: "2025-09-11", km: null, items: [], notes: null }],
    };
    const working = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(working.oils).toEqual([]);
    expect(working.skipped[0]).toMatchObject({ tab: "aceite", row: 26 });
    expect(working.skipped[0].message).toMatch(/kilometraje/i);

    const broken = planLogbookImport(parsed, NO_EXISTING, { ...CTX, odometerWorking: false });
    expect(broken.oils).toHaveLength(1);
  });

  it("carries the parse issues into the skipped list and counts, ordered by tab and row", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      issues: [
        { tab: "llantas", row: 3, message: "Sin cantidad." },
        { tab: "servicios", row: 35, message: "Sin fecha." },
        { tab: "servicios", row: 9, message: "Sin descripción." },
      ],
    };
    const plan = planLogbookImport(parsed, NO_EXISTING, CTX);
    expect(plan.skipped.map((s) => [s.tab, s.row])).toEqual([
      ["servicios", 9],
      ["servicios", 35],
      ["llantas", 3],
    ]);
    expect(plan.counts.servicios.skipped).toBe(2);
    expect(plan.counts.llantas.skipped).toBe(1);
  });
});

describe("previewOf", () => {
  it("lists the four tabs in the logbook order with their counts and the total to create", () => {
    const parsed: LogbookImport = {
      ...EMPTY,
      services: [service("2026-02-13", "LAVADO", 140000), service("2026-02-14", "ENGRASE", 1)],
      fuels: [{ row: 7, date: "2025-07-13", gallons: 100, amount: 935000, provider: null }],
    };
    const preview = previewOf(planLogbookImport(parsed, NO_EXISTING, CTX), "WOM-158");
    expect(preview.plate).toBe("WOM-158");
    expect(preview.total).toBe(3);
    expect(preview.tabs.map((t) => [t.tab, t.label, t.create])).toEqual([
      ["servicios", "Mantenimiento", 2],
      ["aceite", "Aceite", 0],
      ["llantas", "Llantas", 0],
      ["combustible", "Combustible", 1],
    ]);
  });
});
