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
  /** Service, tire and fuel records. */
  logbook: "logbook",
  /** Dashboard figures; derived from the fleet and its owners. */
  dashboard: "dashboard",
  /** Expired-vehicle counts of the nav; derived from the fleet and its owners. */
  expiredCounts: "expired-counts",
} as const;

type EntityTag = typeof CACHE_TAGS.fleet | typeof CACHE_TAGS.owners | typeof CACHE_TAGS.drivers | typeof CACHE_TAGS.sales | typeof CACHE_TAGS.logbook;

/** Files attached to one vehicle (listed on its detail page; the bytes are served by a route). */
export const vehicleFilesTag = (plate: string) => `vehicle-files:${plate}`;

const { fleet, owners, drivers, sales, logbook, dashboard, expiredCounts } = CACHE_TAGS;

export type ReadName =
  | "fleetRows"
  | "vehicleFormOptions"
  | "vehicleDetail"
  | "dashboard"
  | "expiredCounts"
  | "logbookPage"
  | "driverRows"
  | "ownerRows"
  | "saleRows";

/** Tags each cached read is stored under; a write that changes any of them expires the read. */
export const READ_DEPENDENCIES: Record<ReadName, readonly string[]> = {
  fleetRows: [fleet, owners, drivers],
  vehicleFormOptions: [fleet, owners, drivers],
  vehicleDetail: [fleet, owners, drivers, sales, logbook],
  dashboard: [dashboard, fleet, owners],
  expiredCounts: [expiredCounts, fleet, owners],
  logbookPage: [logbook, fleet, owners, drivers],
  driverRows: [drivers, fleet],
  ownerRows: [owners, fleet],
  saleRows: [sales, fleet, owners],
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
  | { kind: "logbook" }
  /** Logbook writes that also change oil changes or the odometer (bulk delete, Excel import). */
  | { kind: "logbook-with-oil" }
  | { kind: "vehicle-file"; plate: string };

const WRITTEN_ENTITIES: Record<Exclude<Change["kind"], "vehicle-file">, EntityTag[]> = {
  vehicle: [fleet, owners, drivers, sales],
  owner: [owners],
  driver: [drivers],
  sale: [sales],
  logbook: [logbook],
  "logbook-with-oil": [logbook, fleet],
};

/** The tags a write must expire so every read that shows what it changed is recomputed. */
export function changeTags(change: Change): string[] {
  if (change.kind === "vehicle-file") return [vehicleFilesTag(change.plate)];

  const tags: string[] = [...WRITTEN_ENTITIES[change.kind]];
  // The dashboard and the nav counts are computed from the fleet and its owners.
  if (tags.includes(fleet) || tags.includes(owners)) tags.push(dashboard, expiredCounts);
  return tags;
}
