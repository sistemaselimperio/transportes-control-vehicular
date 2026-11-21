"use server";

/**
 * Server actions of the loads page. Each one re-checks the session and the role, parses the form
 * with zod, runs a command and expires the cached reads that show loads.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireSectionManager } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { loadRepository } from "../infrastructure/load-repository";
import { createLoadCommands, LoadError, SIESA_TAKEN } from "./load-commands";
import { loadIdSchema, loadSchema } from "./load-schemas";

const commands = createLoadCommands(loadRepository);

/** The checked orders repeat the `orderIds` field, which `Object.fromEntries` would collapse into one; the lines travel as one JSON field. */
const formValues = (fd: FormData) => ({ ...Object.fromEntries(fd.entries()), orderIds: fd.getAll("orderIds") });

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSectionManager("loads");
    const message = await fn();
    expireAfterAction({ kind: "load" });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "load", expected: [LoadError], unique: { load_lines_siesa_number_unique: SIESA_TAKEN } });
  }
}

export async function createLoadAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = loadSchema.parse(formValues(fd));
    await commands.create(input);
    return "Cargue registrado.";
  });
}

export async function updateLoadAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const loadId = loadIdSchema.parse(id);
    const input = loadSchema.parse(formValues(fd));
    await commands.update(loadId, input);
    return "Cargue actualizado.";
  });
}

export async function deleteLoadAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await commands.remove(loadIdSchema.parse(id));
    return "Cargue eliminado.";
  });
}
