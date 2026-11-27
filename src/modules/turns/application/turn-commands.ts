/**
 * Commands of the enturnamientos. Rules live in the domain; this layer re-checks permission and window
 * against the stored jornada on every call (the UI hides controls, it never decides) and talks to the ports.
 */
import { ForbiddenError } from "@/lib/permissions";
import type { IsoDate } from "@/modules/shared/domain/dates";
import {
  assertVehicleEnturnable,
  canCancelTurn,
  canCreateTurn,
  canDeleteTurn,
  canManageTurns,
  compactPositions,
  duplicateVehicleMessage,
  moveTurn,
  moveTurnTo,
  nextPosition,
  TurnError,
  validateWindow,
  windowStatus,
  type Positioned,
  type TurnActor,
  type TurnWindow,
} from "../domain/turn-rules";

export interface TurnDayRecord extends TurnWindow {
  id: number;
  date: IsoDate;
}

/** An active (not cancelled) turn with the name of who enturned it. */
export interface TurnRecord {
  id: number;
  turnDayId: number;
  vehicleId: number;
  destination: string | null;
  position: number;
  createdBy: string | null;
  createdByName: string | null;
}

export interface NewTurn {
  turnDayId: number;
  vehicleId: number;
  destination: string | null;
  position: number;
  createdBy: string;
}

export interface TurnPorts {
  findDayByDate(date: IsoDate): Promise<TurnDayRecord | null>;
  findDay(id: number): Promise<TurnDayRecord | null>;
  insertDay(input: { date: IsoDate; opensAt: Date; closesAt: Date; createdBy: string }): Promise<TurnDayRecord>;
  updateDayWindow(id: number, opensAt: Date, closesAt: Date): Promise<void>;
  findVehicle(id: number): Promise<{ id: number; status: string } | null>;
  /** The turns of the jornada that were not cancelled. */
  listActiveTurns(turnDayId: number): Promise<TurnRecord[]>;
  /** An active turn; null when it does not exist or was cancelled. */
  findTurn(id: number): Promise<TurnRecord | null>;
  insertTurn(input: NewTurn): Promise<void>;
  /** Marks the turn cancelled and renumbers the remaining ones, in one transaction. */
  cancelTurn(id: number, cancelledBy: string, at: Date, renumbered: Positioned[]): Promise<void>;
  /** Removes the turn for good and renumbers the remaining ones, in one transaction. */
  deleteTurn(id: number, renumbered: Positioned[]): Promise<void>;
  savePositions(updates: Positioned[]): Promise<void>;
}

export interface WindowInput {
  opensAt: Date;
  closesAt: Date;
}

const trimmedOrNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

export function createTurnCommands(ports: TurnPorts, clock: () => Date = () => new Date()) {
  function assertAdmin(actor: TurnActor): void {
    if (!canManageTurns(actor)) throw new ForbiddenError();
  }

  function assertWindow({ opensAt, closesAt }: WindowInput): void {
    const problem = validateWindow(opensAt, closesAt);
    if (problem) throw new TurnError(problem);
  }

  async function dayOrFail(id: number): Promise<TurnDayRecord> {
    const day = await ports.findDay(id);
    if (!day) throw new TurnError("La jornada ya no existe. Recarga la página.");
    return day;
  }

  async function turnOrFail(id: number): Promise<TurnRecord> {
    const turn = await ports.findTurn(id);
    if (!turn) throw new TurnError("El turno ya no existe. Recarga la página.");
    return turn;
  }

  return {
    /** Opens the jornada of a date (admin; one per date). */
    async createDay(actor: TurnActor, input: { date: IsoDate } & WindowInput): Promise<void> {
      assertAdmin(actor);
      assertWindow(input);
      if (await ports.findDayByDate(input.date)) throw new TurnError("Ya existe una jornada para esa fecha.");
      await ports.insertDay({ date: input.date, opensAt: input.opensAt, closesAt: input.closesAt, createdBy: actor.userId });
    },

    /** Extends, closes early or reopens a jornada, any time (admin). */
    async updateWindow(actor: TurnActor, dayId: number, input: WindowInput): Promise<void> {
      assertAdmin(actor);
      assertWindow(input);
      await dayOrFail(dayId);
      await ports.updateDayWindow(dayId, input.opensAt, input.closesAt);
    },

    /** Puts an active vehicle last in the queue of the jornada. */
    async enturn(actor: TurnActor, input: { turnDayId: number; vehicleId: number; destination?: string | null }): Promise<void> {
      if (!actor.canAdmin && !actor.canEnturn) throw new ForbiddenError();
      const day = await dayOrFail(input.turnDayId);
      const now = clock();
      if (!canCreateTurn(actor, day, now)) {
        throw new TurnError(
          windowStatus(day, now) === "pending" ? "La jornada todavía no está abierta para enturnar." : "La jornada ya está cerrada.",
        );
      }
      const vehicle = await ports.findVehicle(input.vehicleId);
      if (!vehicle) throw new TurnError("El vehículo ya no existe.");
      assertVehicleEnturnable(vehicle.status);
      const active = await ports.listActiveTurns(day.id);
      const duplicate = active.find((t) => t.vehicleId === vehicle.id);
      if (duplicate) throw new TurnError(duplicateVehicleMessage(duplicate.createdByName));
      await ports.insertTurn({
        turnDayId: day.id,
        vehicleId: vehicle.id,
        destination: trimmedOrNull(input.destination),
        position: nextPosition(active),
        createdBy: actor.userId,
      });
    },

    /** Cancels a turn; the queue closes the gap. */
    async cancel(actor: TurnActor, turnId: number): Promise<void> {
      const turn = await turnOrFail(turnId);
      const day = await dayOrFail(turn.turnDayId);
      const now = clock();
      if (!canCancelTurn(actor, turn, day, now)) throw new ForbiddenError();
      const remaining = (await ports.listActiveTurns(day.id)).filter((t) => t.id !== turn.id);
      await ports.cancelTurn(turn.id, actor.userId, now, compactPositions(remaining));
    },

    /** Deletes a turn without leaving a record; the queue closes the gap (admin). */
    async deleteTurn(actor: TurnActor, turnId: number): Promise<void> {
      if (!canDeleteTurn(actor)) throw new ForbiddenError();
      const turn = await turnOrFail(turnId);
      const remaining = (await ports.listActiveTurns(turn.turnDayId)).filter((t) => t.id !== turn.id);
      await ports.deleteTurn(turn.id, compactPositions(remaining));
    },

    /** One place up or down (admin). */
    async move(actor: TurnActor, turnId: number, direction: "up" | "down"): Promise<void> {
      assertAdmin(actor);
      const turn = await turnOrFail(turnId);
      await ports.savePositions(moveTurn(await ports.listActiveTurns(turn.turnDayId), turn.id, direction));
    },

    /** To a (1-based) position of the queue (admin). */
    async moveTo(actor: TurnActor, turnId: number, position: number): Promise<void> {
      assertAdmin(actor);
      const turn = await turnOrFail(turnId);
      await ports.savePositions(moveTurnTo(await ports.listActiveTurns(turn.turnDayId), turn.id, position));
    },
  };
}

export type TurnCommands = ReturnType<typeof createTurnCommands>;
