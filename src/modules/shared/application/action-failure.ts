import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/permissions";
import { isForeignKeyViolation, isUniqueViolation } from "@/modules/shared/domain/pg-error";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";

type FailureResult = Extract<ActionResult, { ok: false }>;

/**
 * The user-facing result of a server action that threw. Expected domain errors, validation issues,
 * permission and session failures and database constraint violations each get a clear message;
 * anything else is logged and hidden behind a generic one.
 */
export function actionFailure(
  error: unknown,
  options: {
    /** Name of the action family, for the log line of an unexpected failure. */
    label: string;
    /** Domain error classes whose message is meant for the user. */
    expected: ReadonlyArray<abstract new (...args: never[]) => Error>;
    /** Message per unique constraint name, for races the command's own check did not catch. */
    unique?: Readonly<Record<string, string>>;
  },
): FailureResult {
  if (options.expected.some((ErrorClass) => error instanceof ErrorClass)) {
    return { ok: false, error: (error as Error).message };
  }
  if (error instanceof ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Revisa los datos ingresados." };
  }
  if (error instanceof ForbiddenError) return { ok: false, error: error.message };
  if (error instanceof Error && error.message === "No autorizado") {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }
  for (const [constraint, message] of Object.entries(options.unique ?? {})) {
    if (isUniqueViolation(error, constraint)) return { ok: false, error: message };
  }
  if (isUniqueViolation(error)) return { ok: false, error: "Ya existe un registro con esos datos." };
  if (isForeignKeyViolation(error)) {
    return { ok: false, error: "El registro está en uso o ya no existe. Recarga e intenta de nuevo." };
  }
  console.error(`${options.label} action failed`, error);
  return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
}
