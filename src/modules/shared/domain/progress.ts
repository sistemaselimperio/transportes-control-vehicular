/** How much of a set of expected items is on record (the fleet list's completeness indicators). */
export type ProgressState = "missing" | "partial" | "complete";

export interface Progress {
  known: number;
  total: number;
  state: ProgressState;
}

export function progressOf(known: number, total: number): Progress {
  return { known, total, state: known === 0 ? "missing" : known >= total ? "complete" : "partial" };
}
