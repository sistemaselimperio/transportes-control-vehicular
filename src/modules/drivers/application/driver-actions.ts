"use server";

/**
 * Server actions for the drivers page. Each one re-checks the session, parses
 * the form with zod, writes and revalidates the pages that show driver data.
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import {
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
    await requireSession();
    const message = await fn();
    revalidatePath("/conductores");
    revalidatePath("/flota");
    revalidatePath("/flota/[placa]", "page");
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof DriverError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
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
