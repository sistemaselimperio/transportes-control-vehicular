/**
 * One-off load of the trailer maintenance logbooks ("BITACORA TRAILER <placa>.xlsx").
 * For each file: find the trailer by plate, or create it with only its plate and the
 * "Remolque" class, then import its "MANTENIMIENTO" rows with the same parser and planner
 * as the in-app logbook import (rows already saved are skipped, so it is safe to re-run).
 *
 *   npx tsx src/db/load-trailer-logbooks.ts <folder>            # dry run: writes nothing
 *   npx tsx src/db/load-trailer-logbooks.ts <folder> --apply    # writes
 *
 * The plate of each file is listed explicitly: several sheets write it as "TRAILER R21396"
 * or carry an old plate next to the current one, so it is not read from the sheet.
 */
import "./load-env";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { readWorkbook } from "../modules/import-export/infrastructure/xlsx-reader";
import { parseLogbookWorkbook, planLogbookImport } from "../modules/logbook/domain/logbook-import";
import { logbookImportRepository } from "../modules/logbook/infrastructure/logbook-import-repository";
import { todayInBogota } from "../modules/shared/domain/dates";
import { normalizePlate } from "../modules/vehicles/domain/plate";
import { TRAILER_CLASS_NAME } from "../modules/vehicles/domain/trailer";
import { db, schema } from "./index";

/** File (relative to the folder) and the trailer's current plate. */
const FILES: ReadonlyArray<[file: string, plate: string]> = [
  ["BITACORA TRAILER (S91997) R29694 ROJO milton.xlsx", "S91997"],
  ["BITACORA TRAILER ANTIGUO R59418 NUEVO (S90765) JOSE.xlsx", "S90765"],
  ["BITACORA TRAILER R12423  PLANCHA AZUL.xlsx", "R12423"],
  ["BITACORA TRAILER R21396.xlsx", "R21396"],
  ["BITACORA TRAILER R31597  PLANCHA ROJA SQL-877.xlsx", "R31597"],
  ["BITACORA TRAILER R33293 FREDY.xlsx", "R33293"],
  ["BITACORA TRAILER R44884 PIRAQUIVE .xlsx", "R44884"],
  ["BITACORA TRAILER S58917 VERDE.xlsx", "S58917"],
  ["TRAILER S58917/BITACORA S58917.xlsx", "S58917"],
  ["BITACORA TRAILER S76715 MONTAÑO .xlsx", "S76715"],
  ["BITACORA TRAILER S80451 RUPERTO..xlsx", "S80451"],
  ["BITACORA TRAILER S80720 VAGAMUNDO.xlsx", "S80720"],
  ["BITACORA TRAILER S81862 tanque combustible .xlsx", "S81862"],
  ["BITACORA TRAILER S82596 CARDENAS.xlsx", "S82596"],
  ["BITACORA TRAILER S82646 JAIRO.xlsx", "S82646"],
  ["BITACORA TRAILER S88490 COMBUSTIBLE.xlsx", "S88490"],
  ["BITACORA TRAILER S88490 COMBUSTIBLE - copia.xlsx", "S88490"],
];

/** Rows without a date in the sheet: the date taken (the row above, same file) and a note saying so. */
const MISSING_DATES: ReadonlyArray<{ file: string; row: number; date: Date; note: string }> = [
  {
    file: "TRAILER S58917/BITACORA S58917.xlsx",
    row: 9,
    date: new Date(Date.UTC(2025, 7, 19)),
    note: "Sin fecha en la bitácora; se tomó la de la fila anterior",
  },
];

async function main() {
  const folder = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!folder) throw new Error("Usage: tsx src/db/load-trailer-logbooks.ts <folder> [--apply]");
  const today = todayInBogota();

  const [trailerClass] = await db
    .select({ id: schema.vehicleClasses.id })
    .from(schema.vehicleClasses)
    .where(eq(schema.vehicleClasses.name, TRAILER_CLASS_NAME));
  if (!trailerClass) throw new Error(`Class '${TRAILER_CLASS_NAME}' not found.`);

  // Trailers created in this run (dry run: plate -> no id yet), so a second file of the same plate sees it.
  const created = new Map<string, number | null>();
  // Rows planned per plate in a dry run, so a second file of the same plate is deduplicated against them.
  const planned = new Map<string, Array<{ date: string; description: string; price: number | null }>>();
  const totals = { created: 0, services: 0 };

  console.log(apply ? "APPLY: writing to the database.\n" : "DRY RUN: nothing is written.\n");

  for (const [file, rawPlate] of FILES) {
    const plate = normalizePlate(rawPlate);
    const buffer = await readFile(join(folder, file));
    const sheets = await readWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    for (const fix of MISSING_DATES.filter((m) => m.file === file)) {
      const row = sheets.find((s) => s.name.trim().toUpperCase() === "MANTENIMIENTO")?.rows.find((r) => r.rowNumber === fix.row);
      if (!row) throw new Error(`${file}: row ${fix.row} not found`);
      row.cells.B = fix.date;
      row.cells.H = row.cells.H ? `${row.cells.H}; ${fix.note}` : fix.note;
    }
    const parsed = parseLogbookWorkbook(sheets, { today });

    const vehicle = await logbookImportRepository.findVehicle(plate);
    let vehicleId = vehicle?.id ?? created.get(plate) ?? null;
    const isNew = !vehicle && !created.has(plate);
    if (vehicle?.status === "SOLD") {
      console.log(`${plate.padEnd(7)} SKIPPED: sold vehicle (${file})`);
      continue;
    }

    const existing = vehicleId != null ? await logbookImportRepository.loadExisting(vehicleId) : { services: [] };
    const plan = planLogbookImport(
      parsed,
      { ...existing, services: [...existing.services, ...(planned.get(plate) ?? [])] },
      { today },
    );

    if (isNew) {
      totals.created += 1;
      if (apply) {
        const [row] = await db
          .insert(schema.vehicles)
          .values({ plate, classId: trailerClass.id, status: "ACTIVE" })
          .returning({ id: schema.vehicles.id });
        vehicleId = row.id;
      }
      created.set(plate, vehicleId);
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
    if (!apply) planned.set(plate, [...(planned.get(plate) ?? []), ...plan.services]);
    totals.services += plan.services.length;

    const status = vehicle ? "exists " : isNew ? "CREATE " : "created";
    const tech = Object.keys(plan.technical);
    console.log(
      `${plate.padEnd(7)} ${status} | new: ${plan.counts.create} | dup: ${plan.counts.duplicates} | skipped: ${plan.counts.skipped}` +
        `${tech.length ? ` | tech: ${tech.join(",")}` : ""} | ${file}`,
    );
    for (const s of plan.skipped) console.log(`          - ${s.tab} row ${s.row}: ${s.message}`);
  }

  console.log(`\nTrailers to create: ${totals.created}. Maintenance rows to import: ${totals.services}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
