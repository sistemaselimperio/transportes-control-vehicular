"use server";

/**
 * Deletes a submitted inspection for good (test, duplicate or junk submissions from the public
 * link). Inspections managers only (staff); the confirmation lives in the UI.
 */
import { revalidatePath } from "next/cache";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { ForbiddenError } from "@/lib/permissions";
import { requireSectionManager } from "@/lib/session";
import { deleteInspection } from "../infrastructure/inspection-repository";

export type DeleteInspectionResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteInspectionAction(id: string): Promise<DeleteInspectionResult> {
  try {
    await requireSectionManager("inspections");
    if (!UUID.test(id) || !(await deleteInspection(id))) {
      return { ok: false, error: "No se encontró la inspección." };
    }
    revalidatePath("/preoperacionales");
    revalidatePath("/flota/[placa]", "page");
    expireAfterAction({ kind: "inspection" });
    return { ok: true };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("delete inspection failed", e);
    return { ok: false, error: "No se pudo eliminar. Intenta de nuevo." };
  }
}
