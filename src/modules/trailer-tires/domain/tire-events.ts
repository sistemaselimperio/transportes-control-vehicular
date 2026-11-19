/**
 * Events recorded on a trailer's tire positions: changes, repairs, rotations between two positions
 * of the same trailer, and inspections. Pure rules; each guard throws a `RuleError` with end-user copy.
 */
import type { IsoDate } from "@/modules/shared/domain/dates";
import { RuleError } from "@/modules/vehicles/domain/vehicle-rules";
import { isTirePosition, positionLabel, type TirePosition } from "./tire-positions";

export type TireEventType = "CHANGE" | "REPAIR" | "ROTATION" | "INSPECTION";

export const TIRE_EVENT_TYPES: ReadonlyArray<{ key: TireEventType; label: string }> = [
  { key: "CHANGE", label: "Cambio de llanta" },
  { key: "REPAIR", label: "Reparación" },
  { key: "ROTATION", label: "Rotación" },
  { key: "INSPECTION", label: "Inspección" },
];

export type TireCondition = "GOOD" | "FAIR" | "BAD";

export const TIRE_CONDITION_LABELS: Record<TireCondition, string> = {
  GOOD: "Bueno",
  FAIR: "Regular",
  BAD: "Malo",
};

interface EventBase {
  date: IsoDate;
  position: TirePosition;
}

/** What the forms submit; the event type decides which other fields apply. */
export type TireEventValues =
  | (EventBase & {
      type: "CHANGE";
      reference: string;
      provider: string | null;
      price: number | null;
      notes: string | null;
    })
  | (EventBase & { type: "REPAIR"; provider: string | null; price: number | null; notes: string | null })
  | (EventBase & { type: "ROTATION"; counterpart: TirePosition; notes?: string | null })
  | (EventBase & {
      type: "INSPECTION";
      treadDepthMm: number | null;
      pressurePsi: number | null;
      condition: TireCondition | null;
      notes?: string | null;
    });

/** A stored event. */
export type TireEventRow = TireEventValues & { id: number };

/** Only trailers have tire positions. */
export function assertTrailerVehicle(isTrailer: boolean): void {
  if (!isTrailer) throw new RuleError("Las posiciones de llantas solo aplican a remolques.");
}

const blank = (text: string | null | undefined) => text === null || text === undefined || text.trim() === "";

/** The rules each event type adds on top of the field formats. */
export function assertValidTireEvent(event: TireEventValues): void {
  if (!isTirePosition(event.position)) throw new RuleError("Elige una posición válida.");
  switch (event.type) {
    case "CHANGE":
      if (blank(event.reference)) throw new RuleError("Ingresa la referencia de la llanta.");
      return;
    case "REPAIR":
      if (blank(event.notes)) throw new RuleError("Describe la reparación (por ejemplo, parche por pinchazo).");
      return;
    case "ROTATION":
      if (!isTirePosition(event.counterpart)) throw new RuleError("Elige una posición válida.");
      if (event.counterpart === event.position) throw new RuleError("Elige dos posiciones distintas.");
      return;
    case "INSPECTION":
      if (event.treadDepthMm === null && event.pressurePsi === null && event.condition === null) {
        throw new RuleError("Registra al menos una medición o el estado de la llanta.");
      }
      return;
  }
}

/** Newest first: by date, then by id. */
const newestFirst = (a: TireEventRow, b: TireEventRow) =>
  a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1;

const involves = (event: TireEventRow, position: TirePosition) =>
  event.position === position || (event.type === "ROTATION" && event.counterpart === position);

/** The history of one position, most recent first. A rotation belongs to both positions it swaps. */
export function eventsOfPosition(events: readonly TireEventRow[], position: TirePosition): TireEventRow[] {
  return events.filter((e) => involves(e, position)).sort(newestFirst);
}

/** What the diagram shows for a position: its latest event, or null when nothing was recorded. */
export function currentPositionState(events: readonly TireEventRow[], position: TirePosition): TireEventRow | null {
  return eventsOfPosition(events, position)[0] ?? null;
}

/** What the event cost; only changes and repairs have a price. */
export function eventPrice(event: TireEventRow): number | null {
  return event.type === "CHANGE" || event.type === "REPAIR" ? event.price : null;
}

const decimal = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

/** One line for what an event says, seen from `viewed` (a rotation names the other position). */
export function summarizeEvent(
  event: TireEventRow,
  viewed: TirePosition,
): { title: string; detail: string | null } {
  switch (event.type) {
    case "CHANGE":
      return { title: "Cambio de llanta", detail: event.reference };
    case "REPAIR":
      return { title: "Reparación", detail: event.notes };
    case "ROTATION": {
      const other = event.position === viewed ? event.counterpart : event.position;
      return { title: "Rotación", detail: `Con ${positionLabel(other)}` };
    }
    case "INSPECTION": {
      const parts = [
        event.condition ? TIRE_CONDITION_LABELS[event.condition] : null,
        event.treadDepthMm !== null ? `${decimal(event.treadDepthMm)} mm` : null,
        event.pressurePsi !== null ? `${decimal(event.pressurePsi)} psi` : null,
      ].filter(Boolean);
      return { title: "Inspección", detail: parts.join(" · ") || null };
    }
  }
}
