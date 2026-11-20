/** A place of a client where goods are delivered (a "finca"). */
export interface ClientLocationRow {
  id: number;
  clientId: number;
  name: string;
  address: string | null;
  /** The link as pasted from Google Maps. */
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}
