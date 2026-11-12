/** Pure zoom / rotation steps of the attachment viewer (no DOM, testable). */

const LEVELS = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export const MIN_ZOOM = LEVELS[0];
export const MAX_ZOOM = LEVELS[LEVELS.length - 1];
/** The zoom a double tap jumps to: enough to read handwriting on a phone. */
const TOGGLE_ZOOM = 2;

export type Rotation = 0 | 90 | 180 | 270;

/** The next preset level up or down from any zoom, clamped to the limits. */
export function stepZoom(zoom: number, direction: "in" | "out"): number {
  if (direction === "in") return LEVELS.find((level) => level > zoom) ?? MAX_ZOOM;
  return [...LEVELS].reverse().find((level) => level < zoom) ?? MIN_ZOOM;
}

/** Double tap / double click: a fitted image zooms in, anything else goes back to fit. */
export function toggleZoom(zoom: number): number {
  return zoom === 1 ? TOGGLE_ZOOM : 1;
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)} %`;
}
