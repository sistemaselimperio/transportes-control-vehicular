"use server";

/**
 * Server actions of the logbook Excel import. The file travels in a FormData
 * (the server action body limit is set in next.config.ts) and is parsed on the
 * server; the preview writes nothing, and the confirm re-reads the file instead
 * of trusting what the preview showed. Both re-check the session.
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireSession } from "@/lib/session";
import { readWorkbook } from "@/modules/import-export/infrastructure/xlsx-reader";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { plateSchema } from "@/modules/vehicles/application/vehicle-action-schemas";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { importFileProblem, type ImportPreview } from "../domain/logbook-import";
import { logbookImportRepository } from "../infrastructure/logbook-import-repository";
import { createLogbookImport } from "./logbook-import";

export type ImportPreviewResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };

const importer = createLogbookImport({
  repo: logbookImportRepository,
  readSheets: readWorkbook,
  today: todayInBogota,
});

/** The vehicle and the file of the form, validated. */
async function readForm(fd: FormData): Promise<{ plate: string; data: ArrayBuffer }> {
  const plate = plateSchema.parse(fd.get("plate"));
  const file = fd.get("file");
  if (!(file instanceof File)) throw new RuleError("Elige el archivo Excel de la bitácora.");
  const problem = importFileProblem(file);
  if (problem) throw new RuleError(problem);
  return { plate, data: await file.arrayBuffer() };
}

function failure(e: unknown): { ok: false; error: string } {
  if (e instanceof RuleError) return { ok: false, error: e.message };
  if (e instanceof ZodError) return { ok: false, error: "Revisa los datos ingresados." };
  if (e instanceof Error && e.message === "No autorizado") {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }
  console.error("logbook import failed", e);
  return { ok: false, error: "No se pudo procesar el archivo. Intenta de nuevo." };
}

export async function previewLogbookImportAction(fd: FormData): Promise<ImportPreviewResult> {
  try {
    await requireSession();
    const { plate, data } = await readForm(fd);
    return { ok: true, preview: await importer.preview(plate, data) };
  } catch (e) {
    return failure(e);
  }
}

export async function confirmLogbookImportAction(fd: FormData): Promise<ActionResult> {
  try {
    await requireSession();
    const { plate, data } = await readForm(fd);
    const result = await importer.confirm(plate, data);
    revalidatePath("/bitacora");
    revalidatePath("/flota/[placa]", "page");
    revalidatePath("/flota");
    revalidatePath("/");
    return { ok: true, message: result.message };
  } catch (e) {
    return failure(e);
  }
}
