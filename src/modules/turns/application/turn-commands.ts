/**
 * Commands of the enturnamientos. Rules live in the domain; this layer re-checks permission and window
 * against the stored jornada on every call (the UI hides controls, it never decides) and talks to the ports.
 * A turn is a request (product, place, needed hour); an admin assigns the vehicle later.
 */
import { ForbiddenError } from "@/lib/permissions";
import type { IsoDate } from "@/modules/shared/domain/dates";
import {
  assertVehicleAssignable,
  canCancelTurn,
  canCreateTurn,
  canDeleteTurn,
  canEditTurn,
  canManageTurns,
  findCloseAssignments,
  TurnError,
  validateWindow,
  windowStatus,
  type TurnActor,
  type TurnWindow,
} from "../domain/turn-rules";
import { bogotaInstant, isTimeOfDay } from "../domain/turn-window";

export interface TurnDayRecord extends TurnWindow {
  id: number;
  date: IsoDate;
}

/** An active (not cancelled) request with the name of who made it; without a vehicle it is pendiente. */
export interface TurnRecord {
  id: number;
  turnDayId: number;
  vehicleId: number | null;
  product: string;
  /** The place ("Lugar"). */
  destination: string;
  neededAt: Date;
  createdBy: string | null;
  createdByName: string | null;
}

export interface NewTurn {
  turnDayId: number;
  vehicleId: number | null;
  product: string;
  destination: string;
  neededAt: Date;
  createdBy: string;
}

export interface TurnFields {
  product: string;
  destination: string;
  neededAt: Date;
}

export interface TurnPorts {
  findDayByDate(date: IsoDate): Promise<TurnDayRecord | null>;
  findDay(id: number): Promise<TurnDayRecord | null>;
  insertDay(input: { date: IsoDate; opensAt: Date; closesAt: Date; createdBy: string }): Promise<TurnDayRecord>;
  updateDayWindow(id: number, opensAt: Date, closesAt: Date): Promise<void>;
  findVehicle(id: number): Promise<{ id: number; status: string } | null>;
  /** The requests of the jornada that were not cancelled. */
  listActiveTurns(turnDayId: number): Promise<TurnRecord[]>;
  /** An active request; null when it does not exist or was cancelled. */
  findTurn(id: number): Promise<TurnRecord | null>;
  insertTurn(input: NewTurn): Promise<void>;
  updateTurn(id: number, fields: TurnFields): Promise<void>;
  /** Sets the vehicle of the request, or null to take it back to pendiente. */
  assignVehicle(id: number, vehicleId: number | null): Promise<void>;
  /** Marks the request cancelled (soft). */
  cancelTurn(id: number, cancelledBy: string, at: Date): Promise<void>;
  /** Removes the request for good. */
  deleteTurn(id: number): Promise<void>;
}

/** What saving a request tells the admin: the other requests of the same vehicle less than 2 hours away. */
export interface SaveResult {
  conflicts: TurnRecord[];
}

export interface WindowInput {
  opensAt: Date;
  closesAt: Date;
}

export interface RequestInput {
  product: string;
  destination: string;
  /** "HH:mm", Bogotá wall-clock on the date of the jornada. */
  neededTime: string;
}

const TEXT_MAX = 200;

/** The request fields cleaned and checked; the needed hour is read as Bogotá wall-clock on the jornada's date. */
function requestFields(input: RequestInput, day: TurnDayRecord): TurnFields {
  const product = input.product.trim();
  const destination = input.destination.trim();
  if (product === "") throw new TurnError("El producto es obligatorio.");
  if (destination === "") throw new TurnError("El lugar es obligatorio.");
  if (product.length > TEXT_MAX || destination.length > TEXT_MAX) throw new TurnError("El producto o el lugar es demasiado largo.");
  if (!isTimeOfDay(input.neededTime)) throw new TurnError("La hora no es válida.");
  return { product, destination, neededAt: bogotaInstant(day.date, input.neededTime) };
}

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
    if (!turn) throw new TurnError("La solicitud ya no existe. Recarga la página.");
    return turn;
  }

  async function assertAssignable(vehicleId: number): Promise<void> {
    const vehicle = await ports.findVehicle(vehicleId);
    if (!vehicle) throw new TurnError("El vehículo ya no existe.");
    assertVehicleAssignable(vehicle.status);
  }

  /** The other active requests of the jornada that clash with this one, with the target in its new state (its own row is skipped by id). */
  async function conflictsOf(turnDayId: number, target: { id: number; vehicleId: number | null; neededAt: Date }): Promise<TurnRecord[]> {
    if (target.vehicleId === null) return [];
    return findCloseAssignments(target, await ports.listActiveTurns(turnDayId));
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

    /** Creates a request (pendiente). An admin may also assign the vehicle right away. */
    async enturn(actor: TurnActor, input: RequestInput & { turnDayId: number; vehicleId?: number | null }): Promise<SaveResult> {
      if (!actor.canAdmin && !actor.canEnturn) throw new ForbiddenError();
      if (input.vehicleId != null && !actor.canAdmin) throw new ForbiddenError();
      const day = await dayOrFail(input.turnDayId);
      const now = clock();
      if (!canCreateTurn(actor, day, now)) {
        throw new TurnError(
          windowStatus(day, now) === "pending" ? "La jornada todavía no está abierta para solicitar." : "La jornada ya está cerrada.",
        );
      }
      const fields = requestFields(input, day);
      const vehicleId = input.vehicleId ?? null;
      if (vehicleId !== null) await assertAssignable(vehicleId);
      const conflicts = await conflictsOf(day.id, { id: 0, vehicleId, neededAt: fields.neededAt });
      await ports.insertTurn({ turnDayId: day.id, vehicleId, ...fields, createdBy: actor.userId });
      return { conflicts };
    },

    /** Edits product, place and hour: an admin any time, an enturnadora her own pendiente one while open. */
    async updateTurn(actor: TurnActor, turnId: number, input: RequestInput): Promise<SaveResult> {
      const turn = await turnOrFail(turnId);
      const day = await dayOrFail(turn.turnDayId);
      if (!canEditTurn(actor, turn, day, clock())) throw new ForbiddenError();
      const fields = requestFields(input, day);
      const conflicts = await conflictsOf(day.id, { id: turn.id, vehicleId: turn.vehicleId, neededAt: fields.neededAt });
      await ports.updateTurn(turn.id, fields);
      return { conflicts };
    },

    /** Assigns or changes the vehicle, or null to go back to pendiente (admin, any time). */
    async assign(actor: TurnActor, turnId: number, vehicleId: number | null): Promise<SaveResult> {
      assertAdmin(actor);
      const turn = await turnOrFail(turnId);
      if (vehicleId !== null) await assertAssignable(vehicleId);
      const conflicts = await conflictsOf(turn.turnDayId, { id: turn.id, vehicleId, neededAt: turn.neededAt });
      await ports.assignVehicle(turn.id, vehicleId);
      return { conflicts };
    },

    /** Cancels a request (soft): an admin any time, an enturnadora her own pendiente one while open. */
    async cancel(actor: TurnActor, turnId: number): Promise<void> {
      const turn = await turnOrFail(turnId);
      const day = await dayOrFail(turn.turnDayId);
      const now = clock();
      if (!canCancelTurn(actor, turn, day, now)) throw new ForbiddenError();
      await ports.cancelTurn(turn.id, actor.userId, now);
    },

    /** Deletes a request without leaving a record (admin). */
    async deleteTurn(actor: TurnActor, turnId: number): Promise<void> {
      if (!canDeleteTurn(actor)) throw new ForbiddenError();
      const turn = await turnOrFail(turnId);
      await ports.deleteTurn(turn.id);
    },
  };
}

export type TurnCommands = ReturnType<typeof createTurnCommands>;
