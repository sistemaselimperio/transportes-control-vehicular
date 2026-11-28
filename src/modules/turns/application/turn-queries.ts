/**
 * Reads of the enturnamientos. Not cached: several people enturn at once and each must see the others'
 * turns right away. The guard runs on every call.
 */
import { requireTurns } from "@/lib/session";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { buildTurnBoard, type TurnBoard } from "../domain/turn-board";
import { formatBogotaTime } from "../domain/turn-window";
import { turnActorOf } from "./turn-actor";
import { loadDayByDate, loadAssignableVehicles, loadLatestWindow, loadTurnRows } from "../infrastructure/turn-repository";

export interface TurnPageData {
  board: TurnBoard;
  /** Active vehicles an admin can assign; empty for everyone else. */
  vehicles: Array<{ id: number; plate: string }>;
  /** "HH:mm" the create form starts from: the hours of the latest jornada. */
  defaultTimes: { opensTime: string; closesTime: string };
}

const FALLBACK_TIMES = { opensTime: "06:00", closesTime: "18:00" };

/** The requests of one date as the session user may see and use it. */
export async function getTurnPage(date: IsoDate, now: Date): Promise<TurnPageData> {
  const session = await requireTurns();
  const actor = turnActorOf(session);
  const day = await loadDayByDate(date);
  const [turns, vehicles, latest] = await Promise.all([
    day ? loadTurnRows(day.id) : Promise.resolve([]),
    actor.canAdmin ? loadAssignableVehicles() : Promise.resolve([]),
    loadLatestWindow(),
  ]);
  return {
    board: buildTurnBoard({ actor, day, turns, now }),
    vehicles,
    defaultTimes: latest
      ? { opensTime: formatBogotaTime(latest.opensAt), closesTime: formatBogotaTime(latest.closesAt) }
      : FALLBACK_TIMES,
  };
}
