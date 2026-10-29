import { updateVehicleSchema } from "@/modules/vehicles/application/update-vehicle-schema";
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import {
  commandErrorResponse,
  rejectUnlessAdmin,
  invalidBody,
  expireVehicleReads,
  vehicleCommands,
} from "../_lib/responses";

/** Edits the vehicle's own data (plate, class, brand, notes, municipality, service, oil mode, towing). */
export async function PATCH(request: Request, { params }: { params: Promise<{ placa: string }> }) {
  const rejection = await rejectUnlessAdmin(request);
  if (rejection) return rejection;

  const parsed = updateVehicleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody(parsed.error);

  try {
    const { placa } = await params;
    const result = await vehicleCommands.updateVehicle(normalizePlate(placa), parsed.data);
    expireVehicleReads();
    return Response.json(result);
  } catch (e) {
    return commandErrorResponse(e, "No se pudo actualizar el vehículo.");
  }
}
