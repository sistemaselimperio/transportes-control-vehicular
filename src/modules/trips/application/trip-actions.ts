"use server";

/**
 * Server actions of the trips page. Each one re-checks the session, parses the form with zod, runs
 * a command and expires the cached reads that show trips.
 */
import { ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireTripManager } from "@/lib/session";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { tripRepository } from "../infrastructure/trip-repository";
import { createTripCommands, TripError } from "./trip-commands";
import { tripIdSchema, tripSchema } from "./trip-schemas";

const commands = createTripCommands(tripRepository);

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireTripManager();
    const message = await fn();
    expireAfterAction({ kind: "trip" });
    return { ok: true, message };
  } catch (e) {
    if (e instanceof TripError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("trip action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function createTripAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = tripSchema.parse(formValues(fd));
    await commands.create(input);
    return `Viaje a ${input.destination} registrado.`;
  });
}

export async function updateTripAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const tripId = tripIdSchema.parse(id);
    const input = tripSchema.parse(formValues(fd));
    await commands.update(tripId, input);
    return `Viaje a ${input.destination} actualizado.`;
  });
}

export async function deleteTripAction(id: number): Promise<ActionResult> {
  return run(async () => {
    await commands.remove(tripIdSchema.parse(id));
    return "Viaje eliminado.";
  });
}
