import { normalizePlate } from "@/modules/vehicles/domain/plate";

/** Stored form of a plate read from a receipt: uppercase letters and digits only ("ABC123", "R21396"). */
export function normalizeVehiclePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Shown form of a stored plate: "ABC-123", "R-21396". Anything that fits no pattern is shown as stored. */
export function formatVehiclePlate(stored: string): string {
  return stored === "" ? "" : normalizePlate(stored);
}
