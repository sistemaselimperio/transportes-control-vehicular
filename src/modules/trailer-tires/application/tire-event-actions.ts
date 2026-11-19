"use server";

/**
 * Server actions of the trailer tire events. Each one re-checks the session, parses the form with zod,
 * runs a command use case and expires the cached reads that show logbook data (the Bitácora lists
 * these events too). Same section and error handling as the logbook actions.
 */
import type { ZodType } from "zod";
import { z, ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireSectionManager } from "@/lib/session";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { plateSchema } from "@/modules/vehicles/application/vehicle-action-schemas";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { tireEventRepository } from "../infrastructure/tire-event-repository";
import { createTireEventCommands, type CommandResult } from "./tire-event-commands";
import { tireEventIdSchema, tireEventSchema } from "./tire-event-schemas";

const commands = createTireEventCommands(tireEventRepository, todayInBogota);

const parse = <T>(schema: ZodType<T>, data: unknown): T => schema.parse(data);
const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<CommandResult>): Promise<ActionResult> {
  try {
    await requireSectionManager("logbook");
    const result = await fn();
    expireAfterAction({ kind: "logbook" });
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
    console.error("trailer tire action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function createTireEventAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const raw = formValues(fd);
    const { plate } = parse(z.object({ plate: plateSchema }), raw);
    return commands.create(plate, parse(tireEventSchema, raw));
  });
}

export async function updateTireEventAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => commands.update(parse(tireEventIdSchema, id), parse(tireEventSchema, formValues(fd))));
}

export async function deleteTireEventAction(id: number): Promise<ActionResult> {
  return run(async () => commands.remove(parse(tireEventIdSchema, id)));
}
