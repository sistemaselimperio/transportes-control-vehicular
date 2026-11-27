/** What the enturnamientos screen shows for one date, with every permission already decided by the rules. */
import type { IsoDate } from "@/modules/shared/domain/dates";
import { canCancelTurn, canCreateTurn, canDeleteTurn, canManageTurns, windowStatus, type TurnActor, type WindowStatus } from "./turn-rules";

export interface TurnDayRow {
  id: number;
  date: IsoDate;
  opensAt: Date;
  closesAt: Date;
}

/** An active turn of the queue. */
export interface TurnRow {
  id: number;
  position: number;
  vehicleId: number;
  plate: string;
  destination: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
}

export interface TurnView extends TurnRow {
  canCancel: boolean;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface TurnBoard {
  day: TurnDayRow | null;
  /** Null when there is no jornada. */
  status: WindowStatus | null;
  turns: TurnView[];
  /** May enturn a vehicle now. */
  canEnturn: boolean;
  /** Why not, for the screen; null when allowed. */
  enturnBlockedReason: string | null;
  /** Edits the window and reorders. */
  canManage: boolean;
  /** Admin looking at a date with no jornada. */
  canCreateDay: boolean;
}

export function buildTurnBoard(input: { actor: TurnActor; day: TurnDayRow | null; turns: readonly TurnRow[]; now: Date }): TurnBoard {
  const { actor, day, now } = input;
  const canManage = canManageTurns(actor);
  const ordered = [...input.turns].sort((a, b) => a.position - b.position || a.id - b.id);
  const status = day ? windowStatus(day, now) : null;
  const canEnturn = day !== null && canCreateTurn(actor, day, now);

  let enturnBlockedReason: string | null = null;
  if (!canEnturn) {
    if (!day) enturnBlockedReason = "No hay jornada para esta fecha.";
    else if (status === "pending") enturnBlockedReason = "La jornada aún no abre: no se puede enturnar todavía.";
    else enturnBlockedReason = "La jornada está cerrada: no se puede enturnar.";
  }

  const turns = ordered.map((turn, index): TurnView => ({
    ...turn,
    canCancel: day !== null && canCancelTurn(actor, turn, day, now),
    canDelete: canDeleteTurn(actor),
    canMoveUp: canManage && index > 0,
    canMoveDown: canManage && index < ordered.length - 1,
  }));

  return { day, status, turns, canEnturn, enturnBlockedReason, canManage, canCreateDay: day === null && canManage };
}
