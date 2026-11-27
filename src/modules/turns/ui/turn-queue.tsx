"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, X } from "lucide-react";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { cancelTurnAction, deleteTurnAction, moveTurnAction } from "../application/turn-actions";
import type { TurnView } from "../domain/turn-board";
import { formatBogotaClock } from "../domain/turn-window";
import { useTurnAction } from "./use-turn-action";

function TurnItem({ turn, onDone }: { turn: TurnView; onDone: (message: string) => void }) {
  const { run, pending, error } = useTurnAction(onDone);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasControls = turn.canMoveUp || turn.canMoveDown || turn.canCancel || turn.canDelete;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <span className="num w-8 shrink-0 text-lg font-semibold tabular-nums">{turn.position}</span>
      <div className="min-w-0 flex-1">
        <p className="num font-semibold">
          <PlateText plate={turn.plate} />
        </p>
        <p className="truncate text-sm text-muted-foreground">{turn.destination ?? "Sin destino"}</p>
      </div>
      <p className="num text-xs text-muted-foreground">
        {turn.createdByName ?? "—"} · {formatBogotaClock(turn.createdAt)}
      </p>
      {hasControls && (
        <div className="ml-auto flex items-center gap-1">
          {(turn.canMoveUp || turn.canMoveDown) && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:size-9"
                disabled={pending || !turn.canMoveUp}
                onClick={() => run(() => moveTurnAction(turn.id, "up"))}
                aria-label={`Subir el turno de ${turn.plate}`}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:size-9"
                disabled={pending || !turn.canMoveDown}
                onClick={() => run(() => moveTurnAction(turn.id, "down"))}
                aria-label={`Bajar el turno de ${turn.plate}`}
              >
                <ArrowDown aria-hidden />
              </Button>
            </>
          )}
          {turn.canCancel && (
            <Button
              variant="destructive"
              className="h-11 px-3 md:h-9"
              disabled={pending}
              onClick={() => run(() => cancelTurnAction(turn.id))}
              aria-label={`Cancelar el turno de ${turn.plate}`}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
              Cancelar
            </Button>
          )}
          {turn.canDelete && !confirmingDelete && (
            <Button
              variant="outline"
              className="h-11 px-3 text-destructive md:h-9"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Borrar el turno de ${turn.plate}`}
              title="Borrar elimina el turno sin dejar rastro; Cancelar deja registro."
            >
              <Trash2 aria-hidden />
              Borrar
            </Button>
          )}
        </div>
      )}
      {turn.canDelete && confirmingDelete && (
        <div role="alertdialog" aria-label={`Confirmar el borrado del turno de ${turn.plate}`} className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-destructive-soft p-2 text-sm">
          <p className="mr-auto text-destructive">¿Borrar definitivamente? No deja rastro; Cancelar sí deja registro.</p>
          <Button
            variant="destructive"
            className="h-11 px-3 md:h-9"
            disabled={pending}
            onClick={() => run(() => deleteTurnAction(turn.id))}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            Confirmar
          </Button>
          <Button variant="outline" className="h-11 px-3 md:h-9" disabled={pending} onClick={() => setConfirmingDelete(false)}>
            No
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="w-full rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

/** The whole queue, in order. */
export function TurnQueue({ turns, onDone }: { turns: readonly TurnView[]; onDone: (message: string) => void }) {
  if (turns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún no hay vehículos enturnados.</p>
    );
  }
  return (
    <ol className="space-y-2" aria-label="Cola de turnos">
      {turns.map((turn) => (
        <TurnItem key={turn.id} turn={turn} onDone={onDone} />
      ))}
    </ol>
  );
}
