import { createVehicleSchema } from "@/modules/vehicles/application/create-vehicle-schema";
import {
  commandErrorResponse,
  rejectUnlessAdmin,
  invalidBody,
  expireVehicleReads,
  vehicleCommands,
} from "./_lib/responses";

/** Creates a vehicle with its owner, driver, documents, tax and first oil change. */
export async function POST(request: Request) {
  const rejection = await rejectUnlessAdmin(request);
  if (rejection) return rejection;

  const parsed = createVehicleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error);

  try {
    const result = await vehicleCommands.createVehicle(parsed.data);
    expireVehicleReads();
    return Response.json(result, { status: 201 });
  } catch (e) {
    return commandErrorResponse(e, "No se pudo crear el vehículo.");
  }
}
