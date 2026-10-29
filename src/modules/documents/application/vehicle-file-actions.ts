"use server";

/**
 * Server actions for the files of a vehicle. Same shape as the vehicle actions:
 * re-check the session, run a command, expire the cached file list of that vehicle.
 */
import { z, ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireAdmin } from "@/lib/session";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { plateSchema } from "@/modules/vehicles/application/vehicle-action-schemas";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { isFileCategory } from "../domain/vehicle-file-rules";
import { vehicleFileRepository } from "../infrastructure/vehicle-file-repository";
import { createVehicleFileCommands } from "./vehicle-file-commands";

const commands = createVehicleFileCommands(vehicleFileRepository);

async function run(plate: string, fn: () => Promise<{ message: string }>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const result = await fn();
    // The command only succeeds for a plate stored exactly as given, the same one the detail page tags.
    expireAfterAction({ kind: "vehicle-file", plate });
    return { ok: true, message: result.message };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("vehicle file action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function uploadVehicleFileAction(plate: string, fd: FormData): Promise<ActionResult> {
  return run(plate, async () => {
    const category = String(fd.get("category") ?? "");
    const file = fd.get("file");
    if (!isFileCategory(category)) throw new RuleError("Categoría de archivo no válida.");
    if (!(file instanceof File) || file.size === 0) throw new RuleError("Elige un archivo.");
    return commands.uploadVehicleFile(plateSchema.parse(plate), {
      category,
      fileName: file.name,
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    });
  });
}

export async function deleteVehicleFileAction(plate: string, fileId: string): Promise<ActionResult> {
  return run(plate, () => commands.deleteVehicleFile(plateSchema.parse(plate), z.uuid().parse(fileId)));
}
