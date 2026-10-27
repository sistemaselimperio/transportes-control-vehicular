"use server";

/**
 * Server action for the sales page. It re-checks the session, parses the form
 * with zod, writes and expires the cached reads that show sale data.
 */
import { ZodError } from "zod";
import { expireAfterAction } from "@/lib/cache-invalidation";
import { requireSession } from "@/lib/session";
import { assertNotFuture, RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { deleteAllSales, updateSale } from "../infrastructure/sale-repository";
import { saleEditSchema, saleIdSchema } from "./sale-schemas";

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSession();
    const message = await fn();
    expireAfterAction({ kind: "sale" });
    return { ok: true, message };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "Revisa los datos ingresados." };
    }
    if (e instanceof Error && e.message === "No autorizado") {
      return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    }
    console.error("sale action failed", e);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
}

export async function updateSaleAction(id: number, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const saleId = saleIdSchema.parse(id);
    const input = saleEditSchema.parse(formValues(fd));
    if (input.date) assertNotFuture(input.date, todayInBogota());
    if (!(await updateSale(saleId, input))) throw new RuleError("La venta ya no existe.");
    return "Venta actualizada.";
  });
}

/** Removes every sale record; the vehicles keep their SOLD status. */
export async function deleteAllSalesAction(): Promise<ActionResult> {
  return run(async () => {
    const count = await deleteAllSales();
    if (count === 0) throw new RuleError("No hay ventas para eliminar.");
    return count === 1 ? "Se eliminó 1 venta." : `Se eliminaron ${count} ventas.`;
  });
}
