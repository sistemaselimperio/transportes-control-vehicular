"use server";

/**
 * Server actions of the logbook (services, tire changes, fuel fills). Each one
 * re-checks the session, parses the form with zod, runs a command use case and
 * revalidates the pages that show logbook data. Oil changes live in the
 * vehicle actions because they feed the alerts.
 */
import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { z, ZodError } from "zod";
import { requireSession } from "@/lib/session";
import { todayInBogota } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { logbookRepository } from "../infrastructure/logbook-repository";
import { createLogbookCommands, type CommandResult } from "./logbook-commands";
import type { EntryKind } from "./logbook-ports";
import {
  entryIdSchema,
  fuelEditSchema,
  fuelSchema,
  serviceEditSchema,
  serviceSchema,
  tireEditSchema,
  tireSchema,
} from "./logbook-schemas";

const entryKindSchema = z.enum(["service", "tire", "fuel"]);

const commands = createLogbookCommands(logbookRepository, todayInBogota);

const parse = <T>(schema: ZodType<T>, data: unknown): T => schema.parse(data);
const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<CommandResult>): Promise<ActionResult> {
  try {
    await requireSession();
    const result = await fn();
    revalidatePath("/bitacora");
    revalidatePath("/flota/[placa]", "page");
    return { ok: true, message: result.message };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("logbook action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function createServiceAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { plate, ...values } = parse(serviceSchema, formValues(fd));
    return commands.create("service", plate, values);
  });
}

export async function updateServiceAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => commands.update("service", parse(entryIdSchema, id), parse(serviceEditSchema, formValues(fd))));
}

export async function createTireAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { plate, ...values } = parse(tireSchema, formValues(fd));
    return commands.create("tire", plate, values);
  });
}

export async function updateTireAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => commands.update("tire", parse(entryIdSchema, id), parse(tireEditSchema, formValues(fd))));
}

export async function createFuelAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { plate, ...values } = parse(fuelSchema, formValues(fd));
    return commands.create("fuel", plate, values);
  });
}

export async function updateFuelAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => commands.update("fuel", parse(entryIdSchema, id), parse(fuelEditSchema, formValues(fd))));
}

export async function deleteLogbookEntryAction(kind: EntryKind, id: number): Promise<ActionResult> {
  return run(async () => commands.remove(parse(entryKindSchema, kind), parse(entryIdSchema, id)));
}
