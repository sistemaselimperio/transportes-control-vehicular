/**
 * Fills the coordinates of fincas saved before their link could be read: long links are parsed
 * offline, short links are expanded first (one at a time, to stay gentle with Google).
 */
import { isShortMapsLink, parseMapsCoordinates } from "../domain/maps-link";

export interface FincaWithoutCoordinates {
  id: number;
  name: string;
  clientName: string;
  mapsUrl: string;
}

export interface CoordinateUpdate extends FincaWithoutCoordinates {
  latitude: number;
  longitude: number;
  source: "parsed" | "expanded";
}

export interface CoordinateBackfillPlan {
  updates: CoordinateUpdate[];
  unresolved: FincaWithoutCoordinates[];
}

export async function planCoordinateBackfill(
  fincas: FincaWithoutCoordinates[],
  expandMapsLink: (url: string) => Promise<string | null>,
): Promise<CoordinateBackfillPlan> {
  const plan: CoordinateBackfillPlan = { updates: [], unresolved: [] };
  for (const finca of fincas) {
    const short = isShortMapsLink(finca.mapsUrl);
    const url = short ? await expandMapsLink(finca.mapsUrl) : finca.mapsUrl;
    const coordinates = url ? parseMapsCoordinates(url) : null;
    if (coordinates) plan.updates.push({ ...finca, ...coordinates, source: short ? "expanded" : "parsed" });
    else plan.unresolved.push(finca);
  }
  return plan;
}
