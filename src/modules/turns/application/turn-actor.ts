import { canAdminTurns, canEnturn } from "@/lib/permissions";
import type { TurnActor } from "../domain/turn-rules";

/** The turn actor of a session user: the two flags, each closed for anything but `true`. */
export function turnActorOf(session: { user: { id: string; canAdminTurns?: unknown; canEnturn?: unknown } }): TurnActor {
  return {
    userId: session.user.id,
    canAdmin: canAdminTurns(session.user.canAdminTurns),
    canEnturn: canEnturn(session.user.canEnturn),
  };
}
