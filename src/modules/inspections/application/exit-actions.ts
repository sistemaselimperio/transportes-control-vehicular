"use server";

/**
 * Server actions of the exit decision and the novelty closure. Unlike the public form action these
 * need a session that manages the inspections section (staff): an admin can read the result but never write it.
 * The inspection reads are not cached, so there are no cache tags to expire; the paths that show
 * the status are revalidated instead.
 */
import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/permissions";
import { requireSectionManager } from "@/lib/session";
import {
  hasFailedItems,
  validateClosure,
  validateExitDecision,
  type ExitErrors,
} from "../domain/exit-decision";
import {
  findInspectionForDecision,
  saveClosure,
  saveExitDecision,
} from "../infrastructure/inspection-repository";

export type ExitActionResult = { ok: true } | { ok: false; errors: ExitErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND: ExitActionResult = { ok: false, errors: { form: "No se encontró la inspección." } };

function failure(e: unknown, log: string): ExitActionResult {
  if (e instanceof ForbiddenError) return { ok: false, errors: { form: e.message } };
  if (e instanceof Error && e.message === "No autorizado") {
    return { ok: false, errors: { form: "Tu sesión expiró. Vuelve a iniciar sesión." } };
  }
  console.error(log, e);
  return { ok: false, errors: { form: "No se pudo guardar. Intenta de nuevo." } };
}

function revalidate(id: string) {
  revalidatePath(`/preoperacionales/${id}`);
  revalidatePath("/preoperacionales");
  revalidatePath("/flota/[placa]", "page");
}

/** Records or changes the exit decision of an inspection; the latest one wins. */
export async function decideExitAction(id: string, input: unknown): Promise<ExitActionResult> {
  try {
    const session = await requireSectionManager("inspections");
    if (!UUID.test(id)) return NOT_FOUND;
    const validation = validateExitDecision(input);
    if (!validation.ok) return validation;
    if (!(await saveExitDecision(id, validation.value, session.user.id))) return NOT_FOUND;
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return failure(e, "exit decision failed");
  }
}

const ALREADY_CLOSED: ExitActionResult = {
  ok: false,
  errors: { form: "El cierre ya fue registrado y no se puede modificar." },
};

/** Records the closure of the novelties of an inspection that has some item MAL. Final: no edits. */
export async function recordClosureAction(id: string, input: unknown): Promise<ExitActionResult> {
  try {
    const session = await requireSectionManager("inspections");
    if (!UUID.test(id)) return NOT_FOUND;
    const inspection = await findInspectionForDecision(id);
    if (!inspection) return NOT_FOUND;
    if (inspection.closed) return ALREADY_CLOSED;
    const validation = validateClosure(input, {
      inspectionDate: inspection.inspectionDate,
      hasFailedItems: hasFailedItems(inspection.answers),
    });
    if (!validation.ok) return validation;
    // Nothing updated after the checks above: someone closed it in the meantime.
    if (!(await saveClosure(id, validation.value, session.user.id))) return ALREADY_CLOSED;
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return failure(e, "closure failed");
  }
}
