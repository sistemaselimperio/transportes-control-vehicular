"use server";

/**
 * Server actions for the owners page. Each one re-checks the session, parses
 * the form with zod, writes and revalidates the pages that show owner data.
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import {
  findOwnerIdByDocument,
  insertOwner,
  updateOwner,
} from "../infrastructure/owner-repository";
import { ownerIdSchema, ownerSchema, type OwnerInput } from "./owner-schemas";

class OwnerError extends Error {}

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function ensureUniqueDocument(input: OwnerInput, exceptId?: number) {
  if (input.documentNumber && (await findOwnerIdByDocument(input.documentNumber, exceptId)) != null) {
    throw new OwnerError("Ya existe un propietario con ese documento.");
  }
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSession();
    const message = await fn();
    revalidatePath("/propietarios");
    revalidatePath("/flota");
    revalidatePath("/flota/[placa]", "page");
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof OwnerError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("owner action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function createOwnerAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = ownerSchema.parse(formValues(fd));
    await ensureUniqueDocument(input);
    await insertOwner(input);
    return `Propietario ${input.name} creado.`;
  });
}

export async function updateOwnerAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ownerId = ownerIdSchema.parse(id);
    const input = ownerSchema.parse(formValues(fd));
    await ensureUniqueDocument(input, ownerId);
    if (!(await updateOwner(ownerId, input))) throw new OwnerError("El propietario ya no existe.");
    return `Propietario ${input.name} actualizado.`;
  });
}
