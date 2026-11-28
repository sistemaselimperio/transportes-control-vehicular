/**
 * Rules of the enturnamientos: a turn is a REQUEST (product, place, needed hour) that an admin later
 * assigns a vehicle. Who may create, edit or cancel it, when the window allows it and when two requests of
 * one vehicle are too close. Pure; the commands apply them and the UI uses the same functions.
 */
import { formatBogotaClock } from "./turn-window";

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
  /** Administers the turns: everything an enturnadora does, plus jornadas, assigning vehicles and editing any request. */
  canAdmin: boolean;
  /** Creates requests while the window is open. */
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

/** Create and edit jornadas, assign vehicles: admins only. */
export function canManageTurns(actor: TurnActor): boolean {
  return actor.canAdmin;
}

/** An admin always; an enturnadora only while the window is open. */
export function canCreateTurn(actor: TurnActor, day: TurnWindow, now: Date): boolean {
  if (actor.canAdmin) return true;
  return actor.canEnturn && windowStatus(day, now) === "open";
}

export type TurnStatus = "pendiente" | "asignado";

/** A request without a vehicle is pendiente; once an admin assigns one it is asignado. */
export function turnStatus(turn: { vehicleId: number | null }): TurnStatus {
  return turn.vehicleId === null ? "pendiente" : "asignado";
}

interface Authored {
  createdBy: string | null;
  vehicleId: number | null;
}

/** An admin always; an enturnadora only her own request, still pendiente, while the window is open. */
function canChangeOwnPending(actor: TurnActor, turn: Authored, day: TurnWindow, now: Date): boolean {
  if (actor.canAdmin) return true;
  return actor.canEnturn && turn.createdBy === actor.userId && turnStatus(turn) === "pendiente" && windowStatus(day, now) === "open";
}

export function canCancelTurn(actor: TurnActor, turn: Authored, day: TurnWindow, now: Date): boolean {
  return canChangeOwnPending(actor, turn, day, now);
}

export function canEditTurn(actor: TurnActor, turn: Authored, day: TurnWindow, now: Date): boolean {
  return canChangeOwnPending(actor, turn, day, now);
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

/** Only vehicles in service ("ACTIVE") can be assigned. */
export function assertVehicleAssignable(status: string): void {
  if (status !== "ACTIVE") throw new TurnError("Solo se pueden asignar vehículos activos.");
}

const CLOSE_ASSIGNMENT_MS = 2 * 3_600_000;

/** Whether two needed hours are less than two hours apart. */
export function isWithinTwoHours(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) < CLOSE_ASSIGNMENT_MS;
}

export interface Schedulable {
  id: number;
  vehicleId: number | null;
  neededAt: Date;
}

/** The other active requests of the same vehicle needed less than two hours from this one. */
export function findCloseAssignments<T extends Schedulable>(target: Schedulable, others: readonly T[]): T[] {
  if (target.vehicleId === null) return [];
  return others.filter((o) => o.id !== target.id && o.vehicleId === target.vehicleId && isWithinTwoHours(o.neededAt, target.neededAt));
}

/** The non-blocking warning for the admin, or null when nothing is close. */
export function closeAssignmentWarning(conflicts: ReadonlyArray<{ neededAt: Date }>): string | null {
  if (conflicts.length === 0) return null;
  const hours = conflicts.map((c) => formatBogotaClock(c.neededAt)).join(", ");
  return `Atención: ese vehículo ya tiene otra solicitud a menos de 2 horas (${hours}).`;
}
