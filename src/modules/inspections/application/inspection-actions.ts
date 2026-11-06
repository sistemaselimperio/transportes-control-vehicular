"use server";

/**
 * Server action of the public pre-operational form. It is open to anyone (no session on purpose),
 * so it trusts nothing: the domain validation runs again here and the critical-failure flag is
 * computed from the answers, never taken from the client.
 */
import { expireAfterAction } from "@/lib/cache-invalidation";
import { insertInspection } from "../infrastructure/inspection-repository";
import { failedCriticalItems, validateInspection, type InspectionErrors } from "../domain/preoperational-inspection";

export type SubmitInspectionResult =
  | { ok: true; failedCritical: { id: string; label: string }[] }
  | { ok: false; errors: InspectionErrors };

export async function submitInspectionAction(input: unknown): Promise<SubmitInspectionResult> {
  const validation = validateInspection(input);
  if (!validation.ok) return validation;
  const { value } = validation;

  // Honeypot: a bot fills the hidden field. Answer exactly like a success, but save nothing.
  const honeypot = (input as { website?: unknown }).website;
  const isBot = typeof honeypot === "string" && honeypot.trim() !== "";

  if (!isBot) {
    try {
      const saved = await insertInspection(value);
      if (!saved.ok) return { ok: false, errors: { driverId: "Escribe la cédula." } };
      expireAfterAction({ kind: "inspection" });
    } catch (e) {
      console.error("inspection insert failed", e);
      return { ok: false, errors: { form: "No se pudo guardar la inspección. Intenta de nuevo." } };
    }
  }

  const failedCritical = failedCriticalItems(value.answers).map(({ id, label }) => ({ id, label }));
  return { ok: true, failedCritical };
}
