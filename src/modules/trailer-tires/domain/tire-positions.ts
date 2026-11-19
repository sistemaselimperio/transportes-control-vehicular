/**
 * The 12 fixed tire positions of a trailer: 3 axles x 2 sides x dual (inner/outer), no spare.
 * A position is identified by its code, `E{axle}-{I|D}-{INT|EXT}` (I = izquierda, D = derecha).
 * Identity is the position on the trailer, never the physical tire.
 */

export const AXLES = [1, 2, 3] as const;
export type Axle = (typeof AXLES)[number];

export type TireSide = "I" | "D";
export type TireSlot = "INT" | "EXT";

export type TirePosition = `E${Axle}-${TireSide}-${TireSlot}`;

export interface TirePositionInfo {
  code: TirePosition;
  axle: Axle;
  side: TireSide;
  slot: TireSlot;
  label: string;
}

const SIDE_LABELS: Record<TireSide, string> = { I: "Izquierda", D: "Derecha" };
const SLOT_LABELS: Record<TireSlot, string> = { INT: "Interior", EXT: "Exterior" };

/** Reading order of a row of the diagram, seen from behind: left outer, left inner, right inner, right outer. */
const ROW_ORDER: ReadonlyArray<readonly [TireSide, TireSlot]> = [
  ["I", "EXT"],
  ["I", "INT"],
  ["D", "INT"],
  ["D", "EXT"],
];

export const TIRE_POSITIONS: ReadonlyArray<TirePositionInfo> = AXLES.flatMap((axle) =>
  ROW_ORDER.map(([side, slot]) => ({
    code: `E${axle}-${side}-${slot}` as TirePosition,
    axle,
    side,
    slot,
    label: `Eje ${axle} · ${SIDE_LABELS[side]} · ${SLOT_LABELS[slot]}`,
  })),
);

export const TIRE_POSITION_CODES = TIRE_POSITIONS.map((p) => p.code) as [TirePosition, ...TirePosition[]];

const BY_CODE = new Map<string, TirePositionInfo>(TIRE_POSITIONS.map((p) => [p.code, p]));

export function isTirePosition(value: string): value is TirePosition {
  return BY_CODE.has(value);
}

export function positionLabel(code: TirePosition): string {
  return BY_CODE.get(code)?.label ?? code;
}

/** The positions of one axle, left to right as the diagram draws them. */
export function positionsOfAxle(axle: Axle): ReadonlyArray<TirePositionInfo> {
  return TIRE_POSITIONS.filter((p) => p.axle === axle);
}
