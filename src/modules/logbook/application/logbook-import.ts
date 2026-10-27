/**
 * Use cases of the logbook Excel import: a read-only preview and the confirmed
 * import. Both run the same pipeline (read, plate check, plan against what the
 * vehicle already has), so the confirm never trusts what the preview showed:
 * it parses and checks the file again. The workbook reader and the repository
 * are injected, which keeps the use cases unit-testable with fakes.
 */
import { planOilChange } from "@/modules/maintenance/domain/plan-oil-change";
import type { RawSheet } from "@/modules/import-export/domain/types";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { assertEditable, RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import {
  findPlateMismatch,
  parseLogbookWorkbook,
  planLogbookImport,
  previewOf,
  type ImportPlan,
  type ImportPreview,
} from "../domain/logbook-import";
import type { ImportWrite, LogbookImportRepository, PlannedOilChange } from "./logbook-import-ports";

export interface LogbookImportDeps {
  repo: LogbookImportRepository;
  readSheets: (data: ArrayBuffer) => Promise<RawSheet[]>;
  today: () => IsoDate;
}

export interface ImportResult {
  message: string;
  preview: ImportPreview;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function summaryMessage(plan: ImportPlan): string {
  const parts = [
    plan.services.length > 0 && count(plan.services.length, "mantenimiento", "mantenimientos"),
    plan.oils.length > 0 && count(plan.oils.length, "cambio de aceite", "cambios de aceite"),
    plan.tires.length > 0 && count(plan.tires.length, "cambio de llantas", "cambios de llantas"),
    plan.fuels.length > 0 && count(plan.fuels.length, "tanqueo", "tanqueos"),
  ].filter(Boolean);
  return parts.length === 0 ? "No hay registros nuevos para importar." : `Se importaron ${parts.join(", ")}.`;
}

export function createLogbookImport({ repo, readSheets, today }: LogbookImportDeps) {
  /** Reads the file and works out what it would add to the vehicle `plate`; throws a `RuleError` when it cannot be imported. */
  async function prepare(plate: string, data: ArrayBuffer): Promise<{ plan: ImportPlan; write: ImportWrite; vehicleId: number }> {
    let sheets: RawSheet[];
    try {
      sheets = await readSheets(data);
    } catch {
      throw new RuleError("No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.");
    }
    const parsed = parseLogbookWorkbook(sheets);

    const mismatch = findPlateMismatch(parsed.plates, plate);
    if (mismatch) throw new RuleError(mismatch);

    const vehicle = await repo.findVehicle(plate);
    if (!vehicle) throw new RuleError(`El vehículo ${plate} no existe.`);
    assertEditable(vehicle.status);

    const existing = await repo.loadExisting(vehicle.id);
    const plan = planLogbookImport(parsed, existing, { today: today(), odometerWorking: vehicle.odometerWorking });

    // Oil changes are planned like the "Cambio de aceite" button does, oldest first so the
    // odometer only ever rises: next due date/km come from the vehicle's current interval.
    let currentKm = vehicle.currentKm;
    let newCurrentKm: ImportWrite["newCurrentKm"] = null;
    const oils: PlannedOilChange[] = [];
    for (const oil of plan.oils) {
      const planned = planOilChange({
        date: oil.date,
        km: oil.km,
        today: today(),
        vehicle: { odometerWorking: vehicle.odometerWorking, currentKm, oilMode: vehicle.oilMode },
        interval: vehicle.oilInterval,
      });
      if (planned.newCurrentKm !== null) {
        currentKm = planned.newCurrentKm;
        newCurrentKm = { km: planned.newCurrentKm, at: oil.date };
      }
      oils.push({
        date: oil.date,
        km: oil.km,
        intervalMonths: planned.intervalMonths,
        intervalKm: planned.intervalKm,
        nextDate: planned.nextDate,
        nextKm: planned.nextKm,
        price: null,
        notes: oil.notes,
        items: oil.items,
      });
    }

    return {
      plan,
      vehicleId: vehicle.id,
      write: {
        // The file does not say whether a job was preventive or corrective: they all start as
        // preventive and the operator edits the ones that were not.
        services: plan.services.map((s) => ({
          date: s.date,
          kind: "PREVENTIVE",
          description: s.description,
          provider: s.provider,
          km: null,
          price: s.price,
          notes: s.notes,
        })),
        tires: plan.tires.map((t) => ({
          date: t.date,
          quantity: t.quantity,
          reference: t.reference,
          provider: null,
          price: t.price,
          notes: t.notes,
        })),
        fuels: plan.fuels.map((f) => ({ date: f.date, gallons: f.gallons, amount: f.amount, provider: f.provider })),
        oils,
        newCurrentKm,
      },
    };
  }

  return {
    /** What importing `data` into `plate` would do; writes nothing. */
    async preview(plate: string, data: ArrayBuffer): Promise<ImportPreview> {
      const { plan } = await prepare(plate, data);
      return previewOf(plan, plate);
    },
    /** Imports every new record of `data` into `plate`, all or nothing. */
    async confirm(plate: string, data: ArrayBuffer): Promise<ImportResult> {
      const { plan, write, vehicleId } = await prepare(plate, data);
      const preview = previewOf(plan, plate);
      if (preview.total === 0) return { message: summaryMessage(plan), preview };
      await repo.apply(vehicleId, write);
      return { message: summaryMessage(plan), preview };
    },
  };
}

export type LogbookImporter = ReturnType<typeof createLogbookImport>;
