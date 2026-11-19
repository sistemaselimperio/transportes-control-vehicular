"use server";

/**
 * Server actions of the clients page. Each one re-checks the session and the role, parses the form
 * with zod, runs a command and expires the cached reads that show clients.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireSectionManager } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { clientRepository } from "../infrastructure/client-repository";
import { ClientError, createClientCommands } from "./client-commands";
import { clientIdSchema, clientSchema } from "./client-schemas";

const commands = createClientCommands(clientRepository);

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSectionManager("clients");
    const message = await fn();
    expireAfterAction({ kind: "client" });
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, {
      label: "client",
      expected: [ClientError],
      unique: { clients_nit_uq: "Ya existe un cliente con ese NIT." },
    });
  }
}

export async function createClientAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = clientSchema.parse(formValues(fd));
    await commands.create(input);
    return `Cliente ${input.name} creado.`;
  });
}

export async function updateClientAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const clientId = clientIdSchema.parse(id);
    const input = clientSchema.parse(formValues(fd));
    await commands.update(clientId, input);
    return `Cliente ${input.name} actualizado.`;
  });
}

export async function deleteClientAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await commands.remove(clientIdSchema.parse(id));
    return "Cliente eliminado.";
  });
}
