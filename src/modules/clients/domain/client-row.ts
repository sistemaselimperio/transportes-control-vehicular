import { matchesQuery } from "@/modules/shared/domain/search-key";
import type { ClientLocationRow } from "./client-location";
import { buildMapsLink } from "./maps-link";

export interface ClientRow {
  id: number;
  name: string;
  /** Digits only; null when not provided. */
  nit: string | null;
  phone: string | null;
  notes: string | null;
  /** Fincas of the client, by name. */
  locations: ClientLocationRow[];
  /** Deliveries registered for the client; a client with some cannot be deleted. */
  deliveryCount: number;
}

/** Clients whose name or NIT contains every word of the query. */
export function filterClients<T extends Pick<ClientRow, "name" | "nit">>(rows: readonly T[], query: string): T[] {
  return rows.filter((r) => matchesQuery([r.name, r.nit], query));
}

/** Fincas the driver cannot be sent to: no address, link or coordinates. */
export function missingLocationCount(client: Pick<ClientRow, "locations">): number {
  return client.locations.filter((l) => buildMapsLink(l) === null).length;
}

/** The clients list: the search, optionally narrowed to clients with a finca missing its location. */
export function filterClientList<T extends Pick<ClientRow, "name" | "nit" | "locations">>(
  rows: readonly T[],
  query: string,
  onlyMissingLocations: boolean,
): T[] {
  const found = filterClients(rows, query);
  return onlyMissingLocations ? found.filter((r) => missingLocationCount(r) > 0) : found;
}
