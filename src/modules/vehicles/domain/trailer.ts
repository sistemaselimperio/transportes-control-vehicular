/**
 * Trailers are ordinary vehicles of the "Remolque" class. They are anchored to a tractor from the
 * tractor's side; these are the pure rules for that link.
 */
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import { RuleError } from "./vehicle-rules";

/** Name of the vehicle class that marks a trailer (seeded by `db:seed`). */
export const TRAILER_CLASS_NAME = "Remolque";

export function isTrailerClass(className: string): boolean {
  return className.trim().toLowerCase() === TRAILER_CLASS_NAME.toLowerCase();
}

/** A sold or idle (blocked) trailer cannot be anchored to a tractor. */
export function canAnchorTrailerStatus(status: VehicleStatus): boolean {
  return status !== "SOLD" && status !== "IDLE";
}

/** The tractor must be a non-trailer and the trailer an anchorable trailer. */
export function assertCanAnchorTrailer(input: {
  tractor: { plate: string; isTrailer: boolean };
  trailer: { plate: string; isTrailer: boolean; status: VehicleStatus };
}): void {
  const { tractor, trailer } = input;
  if (tractor.isTrailer) throw new RuleError("Un remolque no puede llevar otro remolque.");
  if (!trailer.isTrailer) throw new RuleError(`${trailer.plate} no es un remolque.`);
  if (trailer.status === "SOLD") {
    throw new RuleError(`El remolque ${trailer.plate} está vendido y no se puede anclar.`);
  }
  if (!canAnchorTrailerStatus(trailer.status)) {
    throw new RuleError(`El remolque ${trailer.plate} está inactivo y no se puede anclar.`);
  }
}
