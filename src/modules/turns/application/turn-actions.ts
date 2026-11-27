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
import { TurnError } from "../domain/turn-rules";
import { turnRepository } from "../infrastructure/turn-repository";
import { turnActorOf } from "./turn-actor";
import { createTurnCommands } from "./turn-commands";
import { createDaySchema, enturnSchema, idSchema, windowTimesSchema } from "./turn-schemas";

const commands = createTurnCommands(turnRepository);

const UNIQUE = {
  turns_day_vehicle_active_uq: "Ese vehículo ya está enturnado en esta jornada.",
  turn_days_date_uq: "Ya existe una jornada para esa fecha.",
};

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

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

export async function enturnAction(fd: FormData): Promise<ActionResult> {
  return run(async (actor) => {
    await commands.enturn(actor, enturnSchema.parse(formValues(fd)));
    return "Vehículo enturnado.";
  });
}

export async function cancelTurnAction(turnId: number): Promise<ActionResult> {
  return run(async (actor) => {
    await commands.cancel(actor, idSchema.parse(turnId));
    return "Turno cancelado.";
  });
}

export async function deleteTurnAction(turnId: number): Promise<ActionResult> {
  return run(async (actor) => {
    await commands.deleteTurn(actor, idSchema.parse(turnId));
    return "Turno borrado.";
  });
}

export async function moveTurnAction(turnId: number, direction: "up" | "down"): Promise<ActionResult> {
  return run(async (actor) => {
    if (direction !== "up" && direction !== "down") throw new TurnError("Dirección no válida.");
    await commands.move(actor, idSchema.parse(turnId), direction);
    return "Orden actualizado.";
  });
}
