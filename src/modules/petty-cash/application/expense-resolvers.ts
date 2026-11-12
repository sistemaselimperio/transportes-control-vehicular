/** How the text of an expense (typed or read by the AI) is tied to the fleet and to the owners. */
import { normalizePlate } from "@/modules/vehicles/domain/plate";
import { matchOwner } from "../domain/matching";

/** A fleet plate links the vehicle; anything else is kept as free text in capitals. */
export async function resolveVehicle(
  ports: { findVehicleByPlate(plate: string): Promise<{ id: number; plate: string } | null> },
  text: string,
): Promise<{ vehicleId: number | null; vehicleLabel: string }> {
  let plate: string | null = null;
  try {
    plate = normalizePlate(text);
  } catch {
    plate = null;
  }
  const vehicle = plate ? await ports.findVehicleByPlate(plate) : null;
  if (vehicle) return { vehicleId: vehicle.id, vehicleLabel: vehicle.plate };
  return { vehicleId: null, vehicleLabel: text.replace(/\s+/g, " ").trim().toUpperCase() };
}

/**
 * The billed party is always one of the existing companies (owners): linked, with its canonical
 * name. Anything else resolves to empty, so an expense never carries a company that does not exist.
 */
export function resolveOwner(
  text: string | null,
  owners: ReadonlyArray<{ id: number; name: string }>,
): { ownerId: number | null; company: string | null } {
  const owner = matchOwner(text, owners);
  return owner ? { ownerId: owner.id, company: owner.name } : { ownerId: null, company: null };
}
