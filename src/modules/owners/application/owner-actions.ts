"use server";

/**
 * Server actions for the owners page. Each one re-checks the session, parses
 * the form with zod, writes and expires the cached reads that show owner data.
 */
import { ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireAdmin } from "@/lib/session";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import {
  deleteAllOwners,
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
    await requireAdmin();
    const message = await fn();
    expireAfterAction({ kind: "owner" });
    return { ok: true, message };
  } catch (e) {
    if (e instanceof OwnerError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
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

/** Removes every owner and their ownership links; the vehicles stay. */
export async function deleteAllOwnersAction(): Promise<ActionResult> {
  return run(async () => {
    const count = await deleteAllOwners();
    if (count === 0) throw new OwnerError("No hay propietarios para eliminar.");
    return count === 1 ? "Se eliminó 1 propietario." : `Se eliminaron ${count} propietarios.`;
  });
}
