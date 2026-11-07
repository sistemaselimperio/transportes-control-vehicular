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

/** Classes that can pull a trailer; every other one (cars, motorcycles, machines...) cannot. */
export const TOWING_CLASS_NAMES = ["Camión", "Tractocamión"] as const;

const classKey = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function canTowTrailer(className: string): boolean {
  return TOWING_CLASS_NAMES.some((name) => classKey(name) === classKey(className));
}

/** A sold or idle (blocked) trailer cannot be anchored to a tractor. */
export function canAnchorTrailerStatus(status: VehicleStatus): boolean {
  return status !== "SOLD" && status !== "IDLE";
}

/** The tractor must be of a towing class and the trailer an anchorable trailer. */
export function assertCanAnchorTrailer(input: {
  tractor: { plate: string; isTrailer: boolean; canTow: boolean };
  trailer: { plate: string; isTrailer: boolean; status: VehicleStatus };
}): void {
  const { tractor, trailer } = input;
  if (tractor.isTrailer) throw new RuleError("Un remolque no puede llevar otro remolque.");
  if (!tractor.canTow) {
    throw new RuleError(`${tractor.plate} no puede llevar remolque: solo camiones y tractocamiones.`);
  }
  if (!trailer.isTrailer) throw new RuleError(`${trailer.plate} no es un remolque.`);
  if (trailer.status === "SOLD") {
    throw new RuleError(`El remolque ${trailer.plate} está vendido y no se puede anclar.`);
  }
  if (!canAnchorTrailerStatus(trailer.status)) {
    throw new RuleError(`El remolque ${trailer.plate} está inactivo y no se puede anclar.`);
  }
}
