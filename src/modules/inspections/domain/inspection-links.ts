/**
 * Soft links between a submitted inspection and the fleet / drivers records. The header stays free
 * text; these keys only decide whether it can also point at a registered vehicle or driver. Both
 * sides go through the same normalization (the SQL backfill of the migration mirrors it), and a
 * key that matches nothing or more than one record links to nothing: the submission is never refused.
 */

/** Plate comparison key: upper case, without spaces, hyphens or dots ("abc-123 " -> "ABC123"). */
export function normalizePlateKey(value: string): string {
  return value.replace(/[\s.-]+/g, "").toUpperCase();
}

/** National id comparison key: digits only ("1.234.567-8" -> "12345678"). */
export function normalizeNationalIdKey(value: string): string {
  return value.replace(/\D+/g, "");
}

export type InspectionLinks = {
  vehicleId: number | null;
  trailerVehicleId: number | null;
  driverId: number | null;
};

/** The id whose key equals `key`, or null for a blank key, no match or an ambiguous one. */
function uniqueMatch<T extends { id: number }>(items: readonly T[], key: string, keyOf: (item: T) => string): number | null {
  if (key === "") return null;
  const matches = items.filter((item) => keyOf(item) === key);
  return matches.length === 1 ? matches[0]!.id : null;
}

/** The registered driver the user picked from the list, or null when none or the id is unknown. */
export function findSelectedDriver<T extends { id: number }>(
  selectedDriverId: number | null | undefined,
  drivers: readonly T[],
): T | null {
  if (selectedDriverId == null) return null;
  return drivers.find((d) => d.id === selectedDriverId) ?? null;
}

/** Hint of a national id for the public page: the last four digits only, null when there is no id. */
export function maskNationalId(value: string | null): string | null {
  const digits = normalizeNationalIdKey(value ?? "");
  if (digits === "") return null;
  return `••••${digits.length > 4 ? digits.slice(-4) : ""}`;
}

/**
 * Header identity of the driver. A picked, registered driver supplies the stored name and national
 * id (whatever the client sent is ignored); without a registered id the typed one is required.
 */
export function applySelectedDriver(
  header: { driverName: string; driverNationalId: string; selectedDriverId: number | null },
  drivers: readonly { id: number; name: string; nationalId: string | null }[],
): { ok: true; driverName: string; driverNationalId: string } | { ok: false } {
  const selected = findSelectedDriver(header.selectedDriverId, drivers);
  const driverName = selected?.name ?? header.driverName;
  const registered = selected?.nationalId?.trim() ?? "";
  const driverNationalId = registered || header.driverNationalId;
  return driverNationalId === "" ? { ok: false } : { ok: true, driverName, driverNationalId };
}

/** A picked driver wins; otherwise the typed national id decides, as before. */
export function resolveInspectionLinks(
  header: { plate: string; trailerPlate: string | null; driverNationalId: string; selectedDriverId?: number | null },
  vehicles: readonly { id: number; plate: string }[],
  drivers: readonly { id: number; nationalId: string | null }[],
): InspectionLinks {
  const plateOf = (v: { plate: string }) => normalizePlateKey(v.plate);
  return {
    vehicleId: uniqueMatch(vehicles, normalizePlateKey(header.plate), plateOf),
    trailerVehicleId: uniqueMatch(vehicles, normalizePlateKey(header.trailerPlate ?? ""), plateOf),
    driverId:
      findSelectedDriver(header.selectedDriverId, drivers)?.id ??
      uniqueMatch(drivers, normalizeNationalIdKey(header.driverNationalId), (d) => normalizeNationalIdKey(d.nationalId ?? "")),
  };
}
