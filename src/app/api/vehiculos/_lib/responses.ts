import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { expireAfterRoute } from "@/lib/cache-invalidation";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { createVehicleCommands } from "@/modules/vehicles/application/vehicle-commands";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { vehicleCommandRepository } from "@/modules/vehicles/infrastructure/vehicle-command-repository";

export const vehicleCommands = createVehicleCommands(vehicleCommandRepository, todayInBogota);

export async function hasSession(request: Request): Promise<boolean> {
  return (await auth.api.getSession({ headers: request.headers })) != null;
}

export const unauthorized = () => Response.json({ error: "No autorizado" }, { status: 401 });

export function invalidBody(error: ZodError) {
  return Response.json(
    {
      error: "Solicitud no válida",
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
    { status: 400 },
  );
}

/** Expires the cached reads that show vehicle data after a write (`updateTag` is Server Action only). */
export function expireVehicleReads() {
  expireAfterRoute({ kind: "vehicle" });
}

/** Postgres unique violation (e.g. two requests racing for the same plate). */
function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x as { code?: string } | null)?.code;
  return code(e) === "23505" || code((e as { cause?: unknown } | null)?.cause) === "23505";
}

/** Maps a failed vehicle command to its HTTP response. */
export function commandErrorResponse(e: unknown, fallback: string) {
  if (e instanceof RuleError) return Response.json({ error: e.message }, { status: 422 });
  if (isUniqueViolation(e)) {
    return Response.json({ error: "Ya existe un vehículo con esa placa." }, { status: 409 });
  }
  console.error(fallback, e);
  return Response.json({ error: fallback }, { status: 500 });
}
