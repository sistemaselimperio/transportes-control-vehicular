"use server";

/**
 * Server actions for the drivers page. Each one re-checks the session, parses
 * the form with zod, writes and expires the cached reads that show driver data.
 */
import { ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireDriverManager } from "@/lib/session";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import {
  deleteDriver,
  findDriverIdByNationalId,
  insertDriver,
  updateDriver,
} from "../infrastructure/driver-repository";
import { driverIdSchema, driverSchema, type DriverInput } from "./driver-schemas";

class DriverError extends Error {}

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function ensureUniqueNationalId(input: DriverInput, exceptId?: number) {
  if (input.nationalId && (await findDriverIdByNationalId(input.nationalId, exceptId)) != null) {
    throw new DriverError("Ya existe un conductor con esa cédula.");
  }
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireDriverManager();
    const message = await fn();
    expireAfterAction({ kind: "driver" });
    return { ok: true, message };
  } catch (e) {
    if (e instanceof DriverError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("driver action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function createDriverAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = driverSchema.parse(formValues(fd));
    await ensureUniqueNationalId(input);
    await insertDriver(input);
    return `Conductor ${input.name} creado.`;
  });
}

export async function updateDriverAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const driverId = driverIdSchema.parse(id);
    const input = driverSchema.parse(formValues(fd));
    await ensureUniqueNationalId(input, driverId);
    if (!(await updateDriver(driverId, input))) throw new DriverError("El conductor ya no existe.");
    return `Conductor ${input.name} actualizado.`;
  });
}

/** Removes one driver and their closed assignments; refuses while they are assigned to a vehicle. */
export async function deleteDriverAction(id: number): Promise<ActionResult> {
  return run(async () => {
    const driverId = driverIdSchema.parse(id);
    const result = await deleteDriver(driverId);
    if (result.status === "not_found") throw new DriverError("El conductor ya no existe.");
    if (result.status === "assigned") throw new DriverError(result.message);
    return `Conductor ${result.name} eliminado.`;
  });
}
