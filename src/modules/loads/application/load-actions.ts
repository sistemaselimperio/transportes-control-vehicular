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
import { createLoadCommands, LoadError } from "./load-commands";
import { createLoadsSchema, loadIdSchema, loadSchema } from "./load-schemas";

const commands = createLoadCommands(loadRepository);

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSectionManager("loads");
    const message = await fn();
    expireAfterAction({ kind: "load" });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "load", expected: [LoadError] });
  }
}

/** The loads of one order, one per pending supplier, saved together. */
export async function createLoadsAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = createLoadsSchema.parse(Object.fromEntries(fd.entries()));
    await commands.createForOrder(input);
    return input.blocks.length === 1 ? "Cargue registrado." : `${input.blocks.length} cargues registrados.`;
  });
}

export async function updateLoadAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const loadId = loadIdSchema.parse(id);
    const input = loadSchema.parse(Object.fromEntries(fd.entries()));
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
