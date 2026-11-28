/** What the enturnamientos screen shows for one date, with every permission already decided by the rules. */
import type { IsoDate } from "@/modules/shared/domain/dates";
import {
  canCancelTurn,
  canCreateTurn,
  canDeleteTurn,
  canEditTurn,
  canManageTurns,
  findCloseAssignments,
  turnStatus,
  windowStatus,
  type TurnActor,
  type TurnStatus,
  type WindowStatus,
} from "./turn-rules";

export interface TurnDayRow {
  id: number;
  date: IsoDate;
  opensAt: Date;
  closesAt: Date;
}

/** An active request of the jornada; without a vehicle it is still pendiente. */
export interface TurnRow {
  id: number;
  vehicleId: number | null;
  plate: string | null;
  product: string;
  /** The place ("Lugar"). */
  destination: string;
  neededAt: Date;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface TurnView extends TurnRow {
  status: TurnStatus;
  canEdit: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canAssign: boolean;
  /** The same vehicle has another request less than two hours away. */
  closeToAnother: boolean;
}

export interface TurnBoard {
  day: TurnDayRow | null;
  /** Null when there is no jornada. */
  status: WindowStatus | null;
  turns: TurnView[];
  /** May create a request now. */
  canEnturn: boolean;
  /** Why not, for the screen; null when allowed. */
  enturnBlockedReason: string | null;
  /** Edits the window and assigns vehicles. */
  canManage: boolean;
  /** Admin looking at a date with no jornada. */
  canCreateDay: boolean;
}

export function buildTurnBoard(input: { actor: TurnActor; day: TurnDayRow | null; turns: readonly TurnRow[]; now: Date }): TurnBoard {
  const { actor, day, now } = input;
  const canManage = canManageTurns(actor);
  const ordered = [...input.turns].sort(
    (a, b) => a.neededAt.getTime() - b.neededAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
  );
  const status = day ? windowStatus(day, now) : null;
  const canEnturn = day !== null && canCreateTurn(actor, day, now);

  let enturnBlockedReason: string | null = null;
  if (!canEnturn) {
    if (!day) enturnBlockedReason = "No hay jornada para esta fecha.";
    else if (status === "pending") enturnBlockedReason = "La jornada aún no abre: no se puede solicitar todavía.";
    else enturnBlockedReason = "La jornada está cerrada: no se puede solicitar.";
  }

  const turns = ordered.map(
    (turn): TurnView => ({
      ...turn,
      status: turnStatus(turn),
      canEdit: day !== null && canEditTurn(actor, turn, day, now),
      canCancel: day !== null && canCancelTurn(actor, turn, day, now),
      canDelete: canDeleteTurn(actor),
      canAssign: canManage,
      closeToAnother: findCloseAssignments(turn, ordered).length > 0,
    }),
  );

  return { day, status, turns, canEnturn, enturnBlockedReason, canManage, canCreateDay: day === null && canManage };
}
