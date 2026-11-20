"use server";

/**
 * Server actions of the clients page (clients and their fincas). Each one re-checks the session and
 * the role, parses the form with zod, runs a command and expires the cached reads that show clients.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireSectionManager } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { clientRepository, locationRepository } from "../infrastructure/client-repository";
import {
  ClientError,
  createClientCommands,
  createLocationCommands,
  LOCATION_NAME_TAKEN,
  NAME_TAKEN,
  NIT_TAKEN,
} from "./client-commands";
import { clientIdSchema, clientSchema, locationIdSchema, locationSchema } from "./client-schemas";

const commands = createClientCommands(clientRepository);
const locations = createLocationCommands(locationRepository);

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
      unique: {
        clients_nit_uq: NIT_TAKEN,
        clients_name_key_uq: NAME_TAKEN,
        client_locations_client_name_uq: LOCATION_NAME_TAKEN,
      },
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

export async function createLocationAction(clientId: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const id = clientIdSchema.parse(clientId);
    const input = locationSchema.parse(formValues(fd));
    await locations.create(id, input);
    return `Finca ${input.name} creada.`;
  });
}

export async function updateLocationAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const locationId = locationIdSchema.parse(id);
    const input = locationSchema.parse(formValues(fd));
    await locations.update(locationId, input);
    return `Finca ${input.name} actualizada.`;
  });
}

export async function deleteLocationAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await locations.remove(locationIdSchema.parse(id));
    return "Finca eliminada.";
  });
}
