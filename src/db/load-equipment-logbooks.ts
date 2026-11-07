/**
 * One-off load of the machines and equipment that have no plate (loader, forklifts, a spare
 * engine) with their maintenance logbooks. Each one is a vehicle whose "plate" is an internal
 * code; the classes "Cargador", "Montacargas" and "Equipo" are created if missing.
 * The "MANTENIMIENTO" rows go through the same parser and planner as the in-app logbook
 * import, so re-running creates nothing new.
 *
 *   npx tsx src/db/load-equipment-logbooks.ts <folder>            # dry run: writes nothing
 *   npx tsx src/db/load-equipment-logbooks.ts <folder> --apply    # writes
 */
import "./load-env";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { cellText } from "../modules/import-export/domain/cell-parsers";
import type { RawSheet } from "../modules/import-export/domain/types";
import { readWorkbook } from "../modules/import-export/infrastructure/xlsx-reader";
import { parseLogbookWorkbook, planLogbookImport } from "../modules/logbook/domain/logbook-import";
import { logbookImportRepository } from "../modules/logbook/infrastructure/logbook-import-repository";
import { stripAccents } from "../modules/import-export/domain/cell-parsers";
import { todayInBogota } from "../modules/shared/domain/dates";
import { db, schema } from "./index";

const CLASSES = ["Cargador", "Montacargas", "Equipo"] as const;

const EQUIPMENT: ReadonlyArray<{
  file: string;
  code: string;
  className: (typeof CLASSES)[number];
  brandLine: string | null;
  modelYear: number | null;
  notes: string;
}> = [
  {
    file: "BITACORA CARGADOR.xlsx",
    code: "MAQ-CAR",
    className: "Cargador",
    brandLine: null,
    modelYear: null,
    notes: 'En la bitácora: "CARGADOR OTFP2587".',
  },
  {
    file: "BITACORA LIUGONG 1.xlsx",
    code: "MON-LIU1",
    className: "Montacargas",
    brandLine: "LIUGONG",
    modelYear: 2023,
    notes: 'En la bitácora: "LIUGONG-3584".',
  },
  {
    file: "BITACORA LIUGONG 2 CEMENTO.xlsx",
    code: "MON-LIU2",
    className: "Montacargas",
    brandLine: "LIUGONG",
    modelYear: 2023,
    notes: 'En la bitácora: "LIUGONG 2 CEMENTO".',
  },
  {
    file: "BITACORA TOYOTA.xlsx",
    code: "MON-TOY",
    className: "Montacargas",
    brandLine: "TOYOTA S8",
    modelYear: 2011,
    notes: 'En la bitácora: "MONTACARGAS TOYOTA ROJO".',
  },
  {
    file: "BITACORA MOTOR LUV.xlsx",
    code: "MOT-LUV",
    className: "Equipo",
    brandLine: "LUV",
    modelYear: null,
    notes: "Motor (no es un vehículo).",
  },
];

const norm = (v: unknown) => stripAccents(cellText((v ?? null) as never)).toUpperCase().replace(/:$/, "").trim();

/**
 * The importer has no hour-meter column: a "HOROMETRO" value would be lost (and a
 * "KILOMETRAJE" one read as km), so it is moved
 * into the row's "NOVEDAD" note ("Horómetro: 2628") before parsing.
 */
function keepHourMeter(sheets: RawSheet[]): void {
  const sheet = sheets.find((s) => norm(s.name) === "MANTENIMIENTO");
  if (!sheet) return;
  let hours: string | undefined;
  let notes: string | undefined;
  for (const row of [...sheet.rows].sort((a, b) => a.rowNumber - b.rowNumber)) {
    if (norm(row.cells.B) === "FECHA") {
      const entries = Object.entries(row.cells);
      // A "KILOMETRAJE" column on these machines holds hours too (e.g. 8737.5 on a forklift).
      hours = entries.find(([, v]) => norm(v).startsWith("HOROMETRO") || norm(v).startsWith("KILOMETRAJE"))?.[0];
      notes = entries.find(([, v]) => norm(v).startsWith("NOVEDAD"))?.[0];
      continue;
    }
    if (!hours || !notes) continue;
    const value = cellText(row.cells[hours] ?? null);
    if (value === "") continue;
    const current = cellText(row.cells[notes] ?? null);
    row.cells[notes] = current ? `${current}; Horómetro: ${value}` : `Horómetro: ${value}`;
    delete row.cells[hours];
  }
}

async function main() {
  const folder = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!folder) throw new Error("Usage: tsx src/db/load-equipment-logbooks.ts <folder> [--apply]");
  const today = todayInBogota();
  console.log(apply ? "APPLY: writing to the database.\n" : "DRY RUN: nothing is written.\n");

  const classIds = new Map<string, number | null>();
  for (const name of CLASSES) {
    const [found] = await db
      .select({ id: schema.vehicleClasses.id })
      .from(schema.vehicleClasses)
      .where(eq(schema.vehicleClasses.name, name));
    if (found) {
      classIds.set(name, found.id);
      continue;
    }
    console.log(`Class "${name}": CREATE`);
    if (apply) {
      const [row] = await db
        .insert(schema.vehicleClasses)
        .values({ name, oilIntervalKm: null, oilIntervalMonths: null, documentsDefaultNotApplicable: true })
        .onConflictDoNothing({ target: schema.vehicleClasses.name })
        .returning({ id: schema.vehicleClasses.id });
      classIds.set(name, row?.id ?? null);
    } else {
      classIds.set(name, null);
    }
  }

  let total = 0;
  for (const item of EQUIPMENT) {
    const buffer = await readFile(join(folder, item.file));
    const sheets = await readWorkbook(new Uint8Array(buffer));
    keepHourMeter(sheets);
    const parsed = parseLogbookWorkbook(sheets, { today });

    const existingVehicle = await logbookImportRepository.findVehicle(item.code);
    let vehicleId = existingVehicle?.id ?? null;
    const existing = vehicleId != null ? await logbookImportRepository.loadExisting(vehicleId) : { services: [] };
    const plan = planLogbookImport(parsed, existing, { today });

    if (!existingVehicle && apply) {
      const classId = classIds.get(item.className);
      if (classId == null) throw new Error(`Class ${item.className} missing`);
      const [row] = await db
        .insert(schema.vehicles)
        .values({
          plate: item.code,
          classId,
          status: "ACTIVE",
          brandLine: item.brandLine,
          modelYear: item.modelYear,
          notes: item.notes,
          odometerWorking: false,
        })
        .returning({ id: schema.vehicles.id });
      vehicleId = row.id;
    }
    if (apply && vehicleId != null && (plan.services.length > 0 || Object.keys(plan.technical).length > 0)) {
      await logbookImportRepository.apply(vehicleId, {
        services: plan.services.map((s) => ({
          date: s.date,
          kind: "PREVENTIVE",
          description: s.description,
          provider: s.provider,
          km: s.km,
          price: s.price,
          notes: s.notes,
        })),
        technical: plan.technical,
      });
    }
    total += plan.services.length;
    console.log(
      `${item.code.padEnd(14)} ${existingVehicle ? "exists" : "CREATE"} | ${item.className.padEnd(19)} | new: ${plan.counts.create} | dup: ${plan.counts.duplicates} | skipped: ${plan.counts.skipped} | ${item.file}`,
    );
    for (const s of plan.skipped) console.log(`               - ${s.tab} row ${s.row}: ${s.message}`);
  }
  console.log(`\nMaintenance rows to import: ${total}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
