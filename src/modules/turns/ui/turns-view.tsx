"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeWindowNowAction } from "../application/turn-actions";
import type { TurnBoard } from "../domain/turn-board";
import { formatBogotaClock, formatBogotaTime } from "../domain/turn-window";
import { EnturnForm } from "./enturn-form";
import { TurnQueue } from "./turn-queue";
import { useTurnAction } from "./use-turn-action";
import { WindowBadge } from "./window-badge";
import { WindowForm } from "./window-form";

/** Enturnamientos page: the date, the window of its jornada and the queue, with the controls the user may use. */
export function TurnsView({
  date,
  today,
  board,
  vehicles,
  defaultTimes,
}: {
  date: string;
  today: string;
  board: TurnBoard;
  vehicles: ReadonlyArray<{ id: number; plate: string }>;
  defaultTimes: { opensTime: string; closesTime: string };
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [editing, setEditing] = useState(false);
  const { message, flash } = useFlashMessage();
  const closeNow = useTurnAction(flash);
  const { day, status } = board;

  function goTo(next: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setEditing(false);
    startNavigation(() => router.push(next === today ? "/enturnamientos" : `/enturnamientos?fecha=${next}`));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Enturnamientos"
        description="Cola de vehículos del día. Se puede enturnar solo mientras la jornada está abierta."
        actions={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="turn-date" className="text-xs text-muted-foreground">
                Fecha
              </Label>
              <Input
                id="turn-date"
                type="date"
                className="h-10 md:h-9"
                value={date}
                disabled={navigating}
                onChange={(e) => goTo(e.target.value)}
              />
            </div>
            {date !== today && (
              <Button variant="outline" className="h-10 md:h-9" onClick={() => goTo(today)} disabled={navigating}>
                Hoy
              </Button>
            )}
          </div>
        }
      />

      {day && status ? (
        <section aria-label="Jornada" className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <WindowBadge status={status} />
            <p className="num text-sm">
              Abre {formatBogotaClock(day.opensAt)} · Cierra {formatBogotaClock(day.closesAt)}
            </p>
            {board.canManage && !editing && (
              <div className="ml-auto flex gap-2">
                <Button variant="outline" className="h-10 md:h-9" onClick={() => setEditing(true)}>
                  Editar horario
                </Button>
                {status === "open" && (
                  <Button
                    variant="destructive"
                    className="h-10 md:h-9"
                    disabled={closeNow.pending}
                    onClick={() => closeNow.run(() => closeWindowNowAction(day.id))}
                  >
                    Cerrar ahora
                  </Button>
                )}
              </div>
            )}
          </div>
          {closeNow.error && (
            <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
              {closeNow.error}
            </p>
          )}
          {board.canManage && editing && (
            <WindowForm
              key={`${day.opensAt.getTime()}-${day.closesAt.getTime()}`}
              date={day.date}
              dayId={day.id}
              opensTime={formatBogotaTime(day.opensAt)}
              closesTime={formatBogotaTime(day.closesAt)}
              onDone={flash}
              onCancel={() => setEditing(false)}
            />
          )}
        </section>
      ) : board.canCreateDay ? (
        <section aria-label="Crear jornada" className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">No hay jornada para esta fecha</h2>
          <p className="text-sm text-muted-foreground">Define el horario en el que las enturnadoras pueden enturnar.</p>
          <WindowForm date={date} opensTime={defaultTimes.opensTime} closesTime={defaultTimes.closesTime} onDone={flash} />
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay jornada para esta fecha.</p>
      )}

      {day && (
        <section aria-label="Enturnar vehículo" className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Enturnar vehículo</h2>
          {board.canEnturn ? (
            <EnturnForm turnDayId={day.id} vehicles={vehicles} onDone={flash} />
          ) : (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {board.enturnBlockedReason}
            </p>
          )}
        </section>
      )}

      {day && <TurnQueue turns={board.turns} onDone={flash} />}

      <FlashMessage message={message} />
    </div>
  );
}
