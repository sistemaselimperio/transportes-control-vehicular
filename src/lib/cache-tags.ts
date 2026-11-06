/**
 * Cache tags of the shared reads (`'use cache'`) and the writes that expire them.
 *
 * Everything cached here is company-wide data, never session-derived. A read lists the entities
 * whose rows it shows (`READ_DEPENDENCIES`); a write lists the entities it changes (`changeTags`).
 * Keeping both sides in this one module is what stops a mutation from leaving a stale view behind.
 */

export const CACHE_TAGS = {
  /** Vehicles, documents, taxes, oil changes and the current owner / driver links. */
  fleet: "fleet",
  owners: "owners",
  drivers: "drivers",
  sales: "sales",
  trips: "trips",
  /** Service, tire and fuel records. */
  logbook: "logbook",
  /** Pre-operational inspections; only reads derived from them are cached (who has inspections). */
  inspections: "inspections",
  /** Dashboard figures; derived from the fleet and its owners. */
  dashboard: "dashboard",
  /** Expired-vehicle counts of the nav; derived from the fleet and its owners. */
  expiredCounts: "expired-counts",
  /** Which file categories each vehicle has (the fleet list's documents indicator). */
  files: "fleet-files",
} as const;

type EntityTag = typeof CACHE_TAGS.fleet | typeof CACHE_TAGS.owners | typeof CACHE_TAGS.drivers | typeof CACHE_TAGS.sales | typeof CACHE_TAGS.trips | typeof CACHE_TAGS.logbook | typeof CACHE_TAGS.inspections;

/** Files attached to one vehicle (listed on its detail page; the bytes are served by a route). */
export const vehicleFilesTag = (plate: string) => `vehicle-files:${plate}`;

const { fleet, owners, drivers, sales, trips, logbook, inspections, dashboard, expiredCounts, files } = CACHE_TAGS;

export type ReadName =
  | "fleetRows"
  | "fleetPlates"
  | "vehicleFormOptions"
  | "vehicleDetail"
  | "dashboard"
  | "expiredCounts"
  | "logbookPage"
  | "driverRows"
  | "driverOptions"
  | "ownerRows"
  | "saleRows"
  | "tripRows"
  | "vehicleTrips";

/** Tags each cached read is stored under; a write that changes any of them expires the read. */
export const READ_DEPENDENCIES: Record<ReadName, readonly string[]> = {
  fleetRows: [fleet, owners, drivers, files],
  fleetPlates: [fleet],
  vehicleFormOptions: [fleet, owners, drivers],
  vehicleDetail: [fleet, owners, drivers, sales, logbook],
  dashboard: [dashboard, fleet, owners],
  expiredCounts: [expiredCounts, fleet, owners],
  logbookPage: [logbook, fleet, owners, drivers],
  /** Inspections because each row says whether the driver has any. */
  driverRows: [drivers, fleet, inspections],
  driverOptions: [drivers],
  ownerRows: [owners, fleet],
  saleRows: [sales, fleet, owners],
  /** The fleet is a dependency because deleting a vehicle unlinks its trips. */
  tripRows: [trips, fleet],
  /** Latest trips of one vehicle; same dependencies as `tripRows`. */
  vehicleTrips: [trips, fleet],
};

/** The tags to hand to `cacheTag` for a read. The vehicle detail also needs its plate. */
export function readTags(read: ReadName, plate?: string): string[] {
  const tags = [...READ_DEPENDENCIES[read]];
  if (read === "vehicleDetail" && plate) tags.push(vehicleFilesTag(plate));
  return tags;
}

/** What a write changed. */
export type Change =
  /** Any vehicle command: it can also create an owner, a driver or a sale. */
  | { kind: "vehicle" }
  | { kind: "owner" }
  | { kind: "driver" }
  | { kind: "sale" }
  | { kind: "trip" }
  | { kind: "logbook" }
  /** Logbook writes that also change oil changes or the odometer (bulk delete, Excel import). */
  | { kind: "logbook-with-oil" }
  /** An inspection submitted or deleted. */
  | { kind: "inspection" }
  | { kind: "vehicle-file"; plate: string };

const WRITTEN_ENTITIES: Record<Exclude<Change["kind"], "vehicle-file">, EntityTag[]> = {
  vehicle: [fleet, owners, drivers, sales],
  owner: [owners],
  driver: [drivers],
  sale: [sales],
  trip: [trips],
  logbook: [logbook],
  "logbook-with-oil": [logbook, fleet],
  inspection: [inspections],
};

/** The tags a write must expire so every read that shows what it changed is recomputed. */
export function changeTags(change: Change): string[] {
  if (change.kind === "vehicle-file") return [vehicleFilesTag(change.plate), files];

  const tags: string[] = [...WRITTEN_ENTITIES[change.kind]];
  // The dashboard and the nav counts are computed from the fleet and its owners.
  if (tags.includes(fleet) || tags.includes(owners)) tags.push(dashboard, expiredCounts);
  return tags;
}
