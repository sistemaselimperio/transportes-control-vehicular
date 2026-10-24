"use server";

/**
 * Server action for the sales page. It re-checks the session, parses the form
 * with zod, writes and revalidates the pages that show sale data.
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireSession } from "@/lib/session";
import { assertNotFuture, RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { updateSale } from "../infrastructure/sale-repository";
import { saleEditSchema, saleIdSchema } from "./sale-schemas";

const formValues = (fd: FormData) => Object.fromEntries(fd.entries());

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireSession();
    const message = await fn();
    revalidatePath("/ventas");
    revalidatePath("/flota/[placa]", "page");
    revalidatePath("/");
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
