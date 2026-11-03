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

export function resolveInspectionLinks(
  header: { plate: string; trailerPlate: string | null; driverNationalId: string },
  vehicles: readonly { id: number; plate: string }[],
  drivers: readonly { id: number; nationalId: string | null }[],
): InspectionLinks {
  const plateOf = (v: { plate: string }) => normalizePlateKey(v.plate);
  return {
    vehicleId: uniqueMatch(vehicles, normalizePlateKey(header.plate), plateOf),
    trailerVehicleId: uniqueMatch(vehicles, normalizePlateKey(header.trailerPlate ?? ""), plateOf),
    driverId: uniqueMatch(drivers, normalizeNationalIdKey(header.driverNationalId), (d) => normalizeNationalIdKey(d.nationalId ?? "")),
  };
}
