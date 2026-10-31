import { describe, expect, it } from "vitest";
import type { CellValue } from "@/modules/import-export/domain/cell-parsers";
import type { RawSheet } from "@/modules/import-export/domain/types";
import { EMPTY_TECHNICAL_DATA } from "@/modules/vehicles/domain/technical-data";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import type { ExistingRecords } from "../domain/logbook-import";
import { createLogbookImport } from "./logbook-import";
import type { ImportVehicle, ImportWrite, LogbookImportRepository } from "./logbook-import-ports";

const TODAY = "2026-10-27";
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const rows = (list: Array<[number, Record<string, CellValue>]>) => list.map(([rowNumber, cells]) => ({ rowNumber, cells }));

const workbook = (plate = "WOM-158"): RawSheet[] => [
  {
    name: "MANTENIMIENTO",
    rows: rows([
      [4, { F: "PLACA:", G: plate }],
      [7, { B: "FECHA", C: "DESCRIPCION DEL MANTENIMIENTO", E: "PROVEEDOR", F: "PRECIO" }],
      [8, { B: day(2026, 2, 13), C: "SERVICIO LAVADO GENERAL", E: 91455007, F: 140000 }],
      [9, { C: "SIN FECHA" }],
    ]),
  },
  {
    name: "ACEITE",
    rows: rows([
      [14, { B: "FECHA", C: day(2025, 6, 13) }],
      [16, { B: "KILOMETRAJE", C: 407279 }],
      [19, { B: "CANTIDAD", C: "DETALLE", D: "OBSERVACIONES" }],
      [20, { B: "48 CUARTOS", C: "DELO 15W40" }],
      [26, { B: "FECHA", C: day(2025, 9, 11) }],
      [31, { B: "CANTIDAD", C: "DETALLE" }],
      [32, { B: 1, C: "FILTRO" }],
    ]),
  },
  {
    name: "LLANTAS",
    rows: rows([
      [15, { B: "FECHA", C: day(2025, 7, 17) }],
      [18, { B: "CANTIDAD", C: "DETALLE", D: "OBSERVACION" }],
      [19, { B: 2, C: "LLANTA 295 80 22,5", D: "PENDIENTE" }],
    ]),
  },
  {
    name: "COMBUSTIBLE",
    rows: rows([
      [6, { B: "FECHA", C: "CANTIDAD", D: "VALOR", E: "PROVEEDOR" }],
      [7, { B: day(2025, 7, 13), C: 100, D: 935000, E: "EDS" }],
      [22, { C: "TOTAL MES", D: 935000 }],
    ]),
  },
];

const generalSheet = (plate = "WOM-158"): RawSheet => ({
  name: "DATOS GENERALES",
  rows: rows([
    [3, { B: "PLACA", C: plate }],
    [6, { B: "MODELO:", C: 2023 }],
    [8, { B: "NUMERO DE MOTOR", C: 80392200 }],
    [14, { B: "COLOR", C: "AZUL TROPICAL" }],
  ]),
});

const vehicle: ImportVehicle = { id: 7, status: "ACTIVE" };

const noExisting: ExistingRecords = { services: [] };

function setup(options: { vehicle?: ImportVehicle | null; existing?: ExistingRecords; sheets?: RawSheet[] | Error } = {}) {
  const writes: Array<{ vehicleId: number; write: ImportWrite }> = [];
  const found = options.vehicle === undefined ? vehicle : options.vehicle;
  const repo: LogbookImportRepository = {
    findVehicle: async () => found,
    loadExisting: async () => options.existing ?? noExisting,
    apply: async (vehicleId, write) => void writes.push({ vehicleId, write }),
  };
  const sheets = options.sheets ?? workbook();
  const importer = createLogbookImport({
    repo,
    readSheets: async () => {
      if (sheets instanceof Error) throw sheets;
      return sheets;
    },
    today: () => TODAY,
  });
  return { importer, writes };
}

const data = new ArrayBuffer(8);

describe("preview", () => {
  it("counts what would be created and what is skipped, and writes nothing", async () => {
    const { importer, writes } = setup();
    const preview = await importer.preview("WOM-158", data);
    expect(preview.total).toBe(1); // the ACEITE, LLANTAS and COMBUSTIBLE sheets are not read
    expect(preview.services).toEqual({ create: 1, duplicates: 0, skipped: 1 });
    expect(preview.skipped.map((s) => [s.tab, s.row])).toEqual([["servicios", 9]]);
    expect(writes).toEqual([]);
  });

  it("rejects a file of another plate", async () => {
    const { importer } = setup({ sheets: workbook("ABC-123") });
    await expect(importer.preview("WOM-158", data)).rejects.toThrow(/ABC-123/);
  });

  it("rejects a file without a plate", async () => {
    const { importer } = setup({ sheets: workbook("no es placa") });
    await expect(importer.preview("WOM-158", data)).rejects.toThrow(RuleError);
  });

  it("rejects an unknown or sold vehicle", async () => {
    await expect(setup({ vehicle: null }).importer.preview("WOM-158", data)).rejects.toThrow(/no existe/);
    await expect(setup({ vehicle: { ...vehicle, status: "SOLD" } }).importer.preview("WOM-158", data)).rejects.toThrow(/vendido/);
  });

  it("turns an unreadable file into a rule error", async () => {
    const { importer } = setup({ sheets: new Error("zip") });
    await expect(importer.preview("WOM-158", data)).rejects.toThrow(/Excel/);
  });
});

describe("confirm", () => {
  it("writes the new services in one call, as PREVENTIVE, and nothing from the ignored sheets", async () => {
    const { importer, writes } = setup();
    const result = await importer.confirm("WOM-158", data);

    expect(writes).toHaveLength(1);
    const { vehicleId, write } = writes[0];
    expect(vehicleId).toBe(7);
    expect(write).toEqual({
      services: [
        { date: "2026-02-13", kind: "PREVENTIVE", description: "SERVICIO LAVADO GENERAL", provider: "91455007", km: null, price: 140000, notes: null },
      ],
      technical: {},
    });
    expect(result.message).toBe("Se importaron 1 mantenimiento.");
  });

  it("writes nothing when everything already exists", async () => {
    const existing: ExistingRecords = {
      services: [{ date: "2026-02-13", description: "SERVICIO LAVADO GENERAL", price: 140000 }],
    };
    const { importer, writes } = setup({ existing });
    const result = await importer.confirm("WOM-158", data);
    expect(writes).toEqual([]);
    expect(result.message).toBe("No hay registros nuevos para importar.");
    expect(result.preview.total).toBe(0);
  });

  it("refuses a file of another plate without writing", async () => {
    const { importer, writes } = setup({ sheets: workbook("ABC-123") });
    await expect(importer.confirm("WOM-158", data)).rejects.toThrow(RuleError);
    expect(writes).toEqual([]);
  });
});

describe("technical data from DATOS GENERALES", () => {
  it("fills the empty fields in the same write and reports them in the message", async () => {
    const existing: ExistingRecords = { ...noExisting, technical: { ...EMPTY_TECHNICAL_DATA, color: "ROJO" } };
    const { importer, writes } = setup({ sheets: [generalSheet()], existing });
    const result = await importer.confirm("WOM-158", data);

    expect(writes).toHaveLength(1);
    expect(writes[0].write.technical).toEqual({ modelYear: 2023, engineNumber: "80392200" });
    expect(result.preview.technical).toMatchObject({ count: 2, labels: ["Modelo", "Número de motor"] });
    expect(result.preview.total).toBe(2);
    expect(result.message).toBe("Se importaron 2 datos técnicos.");
  });

  it("previews the fields without writing", async () => {
    const { importer, writes } = setup({ sheets: [generalSheet()] });
    const preview = await importer.preview("WOM-158", data);
    expect(preview.technical.labels).toEqual(["Modelo", "Número de motor", "Color"]);
    expect(writes).toEqual([]);
  });

  it("adds them to the other records in the message", async () => {
    const { importer } = setup({ sheets: [...workbook(), generalSheet()] });
    const result = await importer.confirm("WOM-158", data);
    expect(result.message).toBe(
      "Se importaron 1 mantenimiento, 3 datos técnicos.",
    );
  });

  it("is idempotent: nothing is written once the vehicle has the data", async () => {
    const existing: ExistingRecords = {
      ...noExisting,
      technical: { ...EMPTY_TECHNICAL_DATA, modelYear: 2023, engineNumber: "80392200", color: "AZUL TROPICAL" },
    };
    const { importer, writes } = setup({ sheets: [generalSheet()], existing });
    const result = await importer.confirm("WOM-158", data);
    expect(writes).toEqual([]);
    expect(result.message).toBe("No hay registros nuevos para importar.");
  });
});
