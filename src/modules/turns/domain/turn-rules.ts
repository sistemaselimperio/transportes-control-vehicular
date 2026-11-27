/**
 * Rules of the enturnamientos: who may enturn or cancel, when the window allows it and how the queue
 * is ordered. Pure; the commands apply them and the UI uses the same functions to show or hide controls.
 */

/** A refusal meant for the user. */
export class TurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TurnError";
  }
}

/** The session user as the rules see them: the two flags, never the role. */
export interface TurnActor {
  userId: string;
  /** Administers the turns: everything an enturnadora does, plus jornadas and order. */
  canAdmin: boolean;
  /** Enturns vehicles while the window is open. */
  canEnturn: boolean;
}

export interface TurnWindow {
  opensAt: Date;
  closesAt: Date;
}

export type WindowStatus = "pending" | "open" | "closed";

/** Before `opensAt` the window is pending, from it up to `closesAt` (exclusive) open, from then closed. */
export function windowStatus(day: TurnWindow, now: Date): WindowStatus {
  if (now < day.opensAt) return "pending";
  if (now < day.closesAt) return "open";
  return "closed";
}

/** Create and edit jornadas, reorder the queue: admins only. */
export function canManageTurns(actor: TurnActor): boolean {
  return actor.canAdmin;
}

/** An admin always; an enturnadora only while the window is open. */
export function canCreateTurn(actor: TurnActor, day: TurnWindow, now: Date): boolean {
  if (actor.canAdmin) return true;
  return actor.canEnturn && windowStatus(day, now) === "open";
}

/** An admin always; an enturnadora only her own turns and only while the window is open. */
export function canCancelTurn(actor: TurnActor, turn: { createdBy: string | null }, day: TurnWindow, now: Date): boolean {
  if (actor.canAdmin) return true;
  return actor.canEnturn && turn.createdBy === actor.userId && windowStatus(day, now) === "open";
}

/** Hard delete leaves no trace, so only an admin may do it (any turn, any time). */
export function canDeleteTurn(actor: TurnActor): boolean {
  return actor.canAdmin;
}

/** The message of a bad window, or null when it is fine. */
export function validateWindow(opensAt: Date, closesAt: Date): string | null {
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) return "Las horas de la jornada no son válidas.";
  if (opensAt >= closesAt) return "La hora de apertura debe ser anterior a la de cierre.";
  return null;
}

/** Only vehicles in service ("ACTIVE") can be enturned. */
export function assertVehicleEnturnable(status: string): void {
  if (status !== "ACTIVE") throw new TurnError("Solo se pueden enturnar vehículos activos.");
}

export function duplicateVehicleMessage(enturnedBy: string | null): string {
  return enturnedBy ? `Ya enturnado por ${enturnedBy}.` : "Ya enturnado.";
}

export interface Positioned {
  id: number;
  position: number;
}

/** A new turn goes last. */
export function nextPosition(active: ReadonlyArray<{ position: number }>): number {
  return active.reduce((max, t) => Math.max(max, t.position), 0) + 1;
}

const byQueueOrder = (a: Positioned, b: Positioned) => a.position - b.position || a.id - b.id;

/** The queue renumbered 1..n in its current order (after a cancellation, or to settle ties). */
export function compactPositions(turns: ReadonlyArray<Positioned>): Positioned[] {
  return [...turns].sort(byQueueOrder).map((t, index) => ({ id: t.id, position: index + 1 }));
}

/** The queue with one turn moved to a (1-based) position, clamped to the queue; renumbered 1..n. */
export function moveTurnTo(turns: ReadonlyArray<Positioned>, id: number, position: number): Positioned[] {
  const ordered = [...turns].sort(byQueueOrder);
  const from = ordered.findIndex((t) => t.id === id);
  if (from === -1) throw new TurnError("El turno ya no está en la cola.");
  const [moved] = ordered.splice(from, 1);
  const to = Math.min(Math.max(position, 1), ordered.length + 1) - 1;
  ordered.splice(to, 0, moved);
  return ordered.map((t, index) => ({ id: t.id, position: index + 1 }));
}

/** One place up or down; at an end the order stays. */
export function moveTurn(turns: ReadonlyArray<Positioned>, id: number, direction: "up" | "down"): Positioned[] {
  const ordered = [...turns].sort(byQueueOrder);
  const from = ordered.findIndex((t) => t.id === id);
  if (from === -1) throw new TurnError("El turno ya no está en la cola.");
  return moveTurnTo(turns, id, from + 1 + (direction === "up" ? -1 : 1));
}
