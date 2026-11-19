import { matchesQuery } from "@/modules/shared/domain/search-key";

export interface ClientRow {
  id: number;
  name: string;
  /** Digits only; null when not provided. */
  nit: string | null;
  phone: string | null;
  address: string | null;
  /** The link as pasted from Google Maps. */
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  /** Deliveries registered for the client; a client with some cannot be deleted. */
  deliveryCount: number;
}

/** Clients whose name or NIT contains every word of the query. */
export function filterClients<T extends Pick<ClientRow, "name" | "nit">>(rows: readonly T[], query: string): T[] {
  return rows.filter((r) => matchesQuery([r.name, r.nit], query));
}
