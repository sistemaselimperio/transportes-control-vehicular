/**
 * Exit decision and novelty closure of an inspection (the "Decisión de salida" and "Cierre de la
 * novedad" blocks of form FO-PESV-016). Only the maintenance chief fills them; the server actions
 * validate with these functions and never trust the client.
 */
import { isIsoDate, type InspectionAnswers } from "./preoperational-inspection";

export type ExitDecision = "APTO" | "NO_APTO";
export type ExitStatus = "PENDING" | ExitDecision;

export const EXIT_DECISIONS: readonly ExitDecision[] = ["APTO", "NO_APTO"];

export const MAX_CLOSURE_WORK_ORDER_LENGTH = 40;
export const MAX_CLOSURE_ACTION_LENGTH = 1000;
export const MAX_CLOSURE_RESPONSIBLE_LENGTH = 100;

/** Keyed by field name (or `form`); the value is the user-facing message. */
export type ExitErrors = Record<string, string>;

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: ExitErrors };

export type ExitDecisionInput = { decision: ExitDecision; authorizedTime: string | null };

export type ClosureInput = { date: string; workOrder: string; action: string; responsible: string };

export function exitStatus(inspection: { exitDecision: ExitDecision | null }): ExitStatus {
  return inspection.exitDecision ?? "PENDING";
}

/** Some checklist point is MAL (critical or not): there is a novelty to close. */
export function hasFailedItems(answers: InspectionAnswers): boolean {
  return Object.values(answers).some((answer) => answer.status === "MAL");
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asText = (value: unknown) => (typeof value === "string" ? value : "");

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function validateExitDecision(input: unknown): Validation<ExitDecisionInput> {
  const raw = asRecord(input);
  const decision = raw?.decision;
  if (decision !== "APTO" && decision !== "NO_APTO") return { ok: false, errors: { decision: "Elige APTO o NO APTO." } };
  if (decision === "NO_APTO") return { ok: true, value: { decision, authorizedTime: null } };

  const time = asText(raw?.authorizedTime).trim();
  if (!time) return { ok: false, errors: { authorizedTime: "Indica la hora de salida autorizada." } };
  if (!isTime(time)) return { ok: false, errors: { authorizedTime: "Indica una hora válida (HH:MM)." } };
  return { ok: true, value: { decision, authorizedTime: time } };
}

export function validateClosure(
  input: unknown,
  context: { inspectionDate: string; hasFailedItems: boolean },
): Validation<ClosureInput> {
  const raw = asRecord(input);
  if (!raw) return { ok: false, errors: { form: "Revisa los datos ingresados." } };
  if (!context.hasFailedItems) return { ok: false, errors: { form: "Esta inspección no tiene novedades por cerrar." } };

  const errors: ExitErrors = {};

  const date = asText(raw.date).trim();
  if (!isIsoDate(date)) errors.date = "Indica la fecha de cierre.";
  else if (date < context.inspectionDate) errors.date = "La fecha de cierre no puede ser anterior a la inspección.";

  const workOrder = collapseSpaces(asText(raw.workOrder));
  if (workOrder.length > MAX_CLOSURE_WORK_ORDER_LENGTH) errors.workOrder = `Máximo ${MAX_CLOSURE_WORK_ORDER_LENGTH} caracteres.`;

  const action = collapseSpaces(asText(raw.action));
  if (!action) errors.action = "Describe qué se hizo.";
  else if (action.length > MAX_CLOSURE_ACTION_LENGTH) errors.action = `Máximo ${MAX_CLOSURE_ACTION_LENGTH} caracteres.`;

  const responsible = collapseSpaces(asText(raw.responsible));
  if (responsible.length > MAX_CLOSURE_RESPONSIBLE_LENGTH) errors.responsible = `Máximo ${MAX_CLOSURE_RESPONSIBLE_LENGTH} caracteres.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { date, workOrder, action, responsible } };
}
