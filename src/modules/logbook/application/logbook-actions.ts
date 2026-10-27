"use server";

/**
 * Server actions of the logbook (services, tire changes, fuel fills). Each one
 * re-checks the session, parses the form with zod, runs a command use case and
 * expires the cached reads that show logbook data. Oil changes live in the
 * vehicle actions because they feed the alerts.
 */
import type { ZodType } from "zod";
import { z, ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import type { Change } from "@/lib/cache-tags";
import { requireSession } from "@/lib/session";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { plateSchema } from "@/modules/vehicles/application/vehicle-action-schemas";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { parseLogbookQuery, parseTabParam, type LogbookTab } from "../domain/logbook";
import { logbookRepository } from "../infrastructure/logbook-repository";
import { createLogbookCommands, type CommandResult } from "./logbook-commands";
import type { BulkKind, EntryKind } from "./logbook-ports";
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

async function run(
  fn: () => Promise<CommandResult>,
  change: Change = { kind: "logbook" },
): Promise<ActionResult> {
  try {
    await requireSession();
    const result = await fn();
    expireAfterAction(change);
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

const TAB_KINDS: Record<LogbookTab, BulkKind> = {
  servicios: "service",
  aceite: "oil",
  llantas: "tire",
  combustible: "fuel",
};

/**
 * Deletes every record the Bitácora lists for one vehicle, tab and period. The scope is re-derived
 * here from the same URL parsing the page uses; no record ids come from the client.
 */
export async function deleteLogbookEntriesAction(
  tab: string,
  plate: string,
  from: string,
  to: string,
): Promise<ActionResult> {
  const kind = TAB_KINDS[parseTabParam(tab)];
  return run(
    async () => {
      const query = parseLogbookQuery({ placa: parse(plateSchema, plate), desde: from, hasta: to });
      if (!query.plate) throw new RuleError("Elige una placa para eliminar sus registros.");
      return commands.removeAll(kind, plate, { from: query.from, to: query.to });
    },
    // Oil changes feed the alerts, so deleting them changes the fleet and the dashboard too.
    { kind: kind === "oil" ? "logbook-with-oil" : "logbook" },
  );
}

export async function deleteLogbookEntryAction(kind: EntryKind, id: number): Promise<ActionResult> {
  return run(async () => commands.remove(parse(entryKindSchema, kind), parse(entryIdSchema, id)));
}
