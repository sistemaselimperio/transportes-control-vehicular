"use server";

/**
 * Server actions of the maintenance import from a photo. Reading the file writes nothing; saving
 * runs every reviewed row through the same schema and command as the single-record form. Both
 * re-check the session with the same guard as the other logbook writes. The photo travels in a
 * FormData (the server action body limit is set in next.config.ts); the browser shrinks it first.
 */
import { z, ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireSectionManager } from "@/lib/session";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { loadVehicleFormLists } from "@/modules/vehicles/infrastructure/vehicle-repository";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { loadProviders, logbookRepository } from "../infrastructure/logbook-repository";
import { openAiServiceExtractor } from "../infrastructure/openai-service-extractor";
import { createLogbookCommands } from "./logbook-commands";
import {
  createServicePhotoImport,
  saveServiceRows,
  type ServiceDraft,
  type ServiceRowError,
} from "./service-photo-import";

export type ReadPhotoResult = { ok: true; rows: ServiceDraft[] } | { ok: false; error: string };

export type SaveRowsActionResult =
  | { ok: true; saved: number; errors: ServiceRowError[]; message: string }
  | { ok: false; error: string };

const photoImport = createServicePhotoImport({
  extractor: openAiServiceExtractor,
  loadPlates: async () => (await loadVehicleFormLists()).plates,
  loadProviders,
  today: todayInBogota,
});

const commands = createLogbookCommands(logbookRepository, todayInBogota);

const rowsSchema = z.array(z.record(z.string(), z.string().max(1000))).max(500);

function failure(e: unknown): { ok: false; error: string } {
  if (e instanceof RuleError) return { ok: false, error: e.message };
  if (e instanceof ZodError) return { ok: false, error: "Revisa los datos ingresados." };
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof Error && e.message === "No autorizado") {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }
  console.error("logbook photo import failed", e);
  return { ok: false, error: "No se pudo procesar el archivo. Intenta de nuevo." };
}

/** Reads the photo or PDF and returns its maintenance rows as drafts to review; nothing is saved. */
export async function readServicesFromPhotoAction(fd: FormData): Promise<ReadPhotoResult> {
  try {
    await requireSectionManager("logbook");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new RuleError("Elige una foto o un PDF.");
    const plate = fd.get("plate");
    const rows = await photoImport.read(
      { fileName: file.name, data: Buffer.from(await file.arrayBuffer()) },
      typeof plate === "string" && plate !== "" ? plate : null,
    );
    return { ok: true, rows };
  } catch (e) {
    return failure(e);
  }
}

/** Saves the reviewed rows one by one: the ones that fail come back with their reason, the rest are kept. */
export async function saveServicesFromPhotoAction(rows: Record<string, string>[]): Promise<SaveRowsActionResult> {
  try {
    await requireSectionManager("logbook");
    const { saved, errors } = await saveServiceRows(commands, rowsSchema.parse(rows));
    if (saved > 0) expireAfterAction({ kind: "logbook" });
    const message = saved === 1 ? "1 mantenimiento registrado." : `${saved} mantenimientos registrados.`;
    return { ok: true, saved, errors, message };
  } catch (e) {
    return failure(e);
  }
}
