"use server";

/**
 * Server actions of the enturnamientos. Each one re-checks the session flags, parses its input with zod
 * and runs a command, which checks permission and window against the stored jornada again: nothing
 * the screen hides or shows is trusted.
 */
import { revalidatePath } from "next/cache";
import { requireTurns } from "@/lib/session";
import { actionFailure } from "@/modules/shared/application/action-failure";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { bogotaInstant } from "../domain/turn-window";
import { closeAssignmentWarning, TurnError } from "../domain/turn-rules";
import { turnRepository } from "../infrastructure/turn-repository";
import { turnActorOf } from "./turn-actor";
import { createTurnCommands } from "./turn-commands";
import type { SaveResult } from "./turn-commands";
import { assignSchema, createDaySchema, enturnSchema, idSchema, updateTurnSchema, windowTimesSchema } from "./turn-schemas";

const commands = createTurnCommands(turnRepository);

const UNIQUE = {
  turn_days_date_uq: "Ya existe una jornada para esa fecha.",
};

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

/** The success message plus the non-blocking warning when the same vehicle has another request within 2 hours. */
const withWarning = (message: string, result: SaveResult): string => {
  const warning = closeAssignmentWarning(result.conflicts);
  return warning ? `${message} ${warning}` : message;
};

async function run(fn: (actor: ReturnType<typeof turnActorOf>) => Promise<string>): Promise<ActionResult> {
  try {
    const session = await requireTurns();
    const message = await fn(turnActorOf(session));
    revalidatePath("/enturnamientos");
    return { ok: true, message };
  } catch (e) {
    return actionFailure(e, { label: "turns", expected: [TurnError], unique: UNIQUE });
  }
}

/** Opens the jornada of a date (admin). */
export async function createDayAction(fd: FormData): Promise<ActionResult> {
  return run(async (actor) => {
    const input = createDaySchema.parse(formValues(fd));
    await commands.createDay(actor, {
      date: input.date,
      opensAt: bogotaInstant(input.date, input.opensTime),
      closesAt: bogotaInstant(input.date, input.closesTime),
    });
    return "Jornada creada.";
  });
}

/** Changes the window of a jornada: extend, close early or reopen (admin). */
export async function updateWindowAction(dayId: number, fd: FormData): Promise<ActionResult> {
  return run(async (actor) => {
    const id = idSchema.parse(dayId);
    const times = windowTimesSchema.parse(formValues(fd));
    const day = await turnRepository.findDay(id);
    if (!day) throw new TurnError("La jornada ya no existe. Recarga la página.");
    await commands.updateWindow(actor, id, {
      opensAt: bogotaInstant(day.date, times.opensTime),
      closesAt: bogotaInstant(day.date, times.closesTime),
    });
    return "Horario actualizado.";
  });
}

/** Closes the window right now (admin). */
export async function closeWindowNowAction(dayId: number): Promise<ActionResult> {
  return run(async (actor) => {
    const id = idSchema.parse(dayId);
    const day = await turnRepository.findDay(id);
    if (!day) throw new TurnError("La jornada ya no existe. Recarga la página.");
    await commands.updateWindow(actor, id, { opensAt: day.opensAt, closesAt: new Date() });
    return "Jornada cerrada.";
  });
}

/** Creates a request: product, place and needed hour (an admin may also pick the vehicle). */
export async function enturnAction(fd: FormData): Promise<ActionResult> {
  return run(async (actor) => {
    const result = await commands.enturn(actor, enturnSchema.parse(formValues(fd)));
    return withWarning("Solicitud creada.", result);
  });
}

/** Edits product, place and hour of a request. */
export async function updateTurnAction(turnId: number, fd: FormData): Promise<ActionResult> {
  return run(async (actor) => {
    const result = await commands.updateTurn(actor, idSchema.parse(turnId), updateTurnSchema.parse(formValues(fd)));
    return withWarning("Solicitud actualizada.", result);
  });
}

/** Assigns or changes the vehicle of a request, or null to take it back to pendiente (admin). */
export async function assignTurnAction(turnId: number, vehicleId: number | null): Promise<ActionResult> {
  return run(async (actor) => {
    const vehicle = assignSchema.parse(vehicleId);
    const result = await commands.assign(actor, idSchema.parse(turnId), vehicle);
    return withWarning(vehicle === null ? "Solicitud devuelta a pendiente." : "Vehículo asignado.", result);
  });
}

export async function cancelTurnAction(turnId: number): Promise<ActionResult> {
  return run(async (actor) => {
    await commands.cancel(actor, idSchema.parse(turnId));
    return "Solicitud cancelada.";
  });
}

export async function deleteTurnAction(turnId: number): Promise<ActionResult> {
  return run(async (actor) => {
    await commands.deleteTurn(actor, idSchema.parse(turnId));
    return "Solicitud borrada.";
  });
}
