"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Pencil, Trash2, Truck, X } from "lucide-react";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignTurnAction, cancelTurnAction, deleteTurnAction, updateTurnAction } from "../application/turn-actions";
import { PLACE_MAX, PRODUCT_MAX } from "../application/turn-schemas";
import type { TurnView } from "../domain/turn-board";
import { formatBogotaClock, formatBogotaTime } from "../domain/turn-window";
import { PlatePicker, type Vehicle } from "./plate-picker";
import { useTurnAction } from "./use-turn-action";

const FIELD = "h-10 md:h-9";

function StatusBadge({ turn }: { turn: TurnView }) {
  const assigned = turn.status === "asignado";
  return (
    <span
      className={
        assigned
          ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {assigned ? "Asignado" : "Pendiente"}
    </span>
  );
}

/** Inline form to change product, place and hour of a request. */
function EditForm({ turn, onDone, onClose }: { turn: TurnView; onDone: (message: string) => void; onClose: () => void }) {
  const { run, pending, error } = useTurnAction(onDone);
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2 rounded-lg bg-muted p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => updateTurnAction(turn.id, fd), onClose);
      }}
    >
      <label className="min-w-32 flex-1 text-xs text-muted-foreground">
        Producto
        <Input name="product" className={FIELD} defaultValue={turn.product} maxLength={PRODUCT_MAX} required autoComplete="off" />
      </label>
      <label className="min-w-32 flex-1 text-xs text-muted-foreground">
        Lugar
        <Input name="destination" className={FIELD} defaultValue={turn.destination} maxLength={PLACE_MAX} required autoComplete="off" />
      </label>
      <label className="w-28 text-xs text-muted-foreground">
        Hora
        <Input name="neededTime" type="time" className={FIELD} defaultValue={formatBogotaTime(turn.neededAt)} required />
      </label>
      <Button type="submit" className="h-11 px-3 md:h-9" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Guardar
      </Button>
      <Button type="button" variant="outline" className="h-11 px-3 md:h-9" disabled={pending} onClick={onClose}>
        Cerrar
      </Button>
      {error && (
        <p role="alert" className="w-full rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

/** Inline vehicle picker for the admin: choosing a plate assigns (or changes) the vehicle right away. */
function AssignPanel({
  turn,
  vehicles,
  onDone,
  onClose,
}: {
  turn: TurnView;
  vehicles: ReadonlyArray<Vehicle>;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const { run, pending, error } = useTurnAction(onDone);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-muted p-2">
      <div className="w-full sm:w-56">
        <PlatePicker
          id={`turn-assign-${turn.id}`}
          vehicles={vehicles}
          selected={selected}
          invalid={false}
          onSelect={(vehicle) => {
            setSelected(vehicle);
            if (vehicle) run(() => assignTurnAction(turn.id, vehicle.id), onClose);
          }}
        />
      </div>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      <Button type="button" variant="outline" className="h-11 px-3 md:h-9" disabled={pending} onClick={onClose}>
        Cerrar
      </Button>
      {error && (
        <p role="alert" className="w-full rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function TurnItem({ turn, vehicles, onDone }: { turn: TurnView; vehicles: ReadonlyArray<Vehicle>; onDone: (message: string) => void }) {
  const { run, pending, error } = useTurnAction(onDone);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const hasControls = turn.canEdit || turn.canAssign || turn.canCancel || turn.canDelete;
  const label = `${turn.product} · ${turn.destination}`;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <span className="num w-24 shrink-0 text-lg font-semibold tabular-nums">{formatBogotaClock(turn.neededAt)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{turn.product}</p>
        <p className="truncate text-sm text-muted-foreground">{turn.destination}</p>
      </div>
      <div className="flex items-center gap-2">
        <p className="num font-semibold">{turn.plate ? <PlateText plate={turn.plate} /> : <span className="text-muted-foreground">Pendiente</span>}</p>
        <StatusBadge turn={turn} />
        {turn.closeToAnother && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive"
            title="Este vehículo tiene otra solicitud a menos de 2 horas."
          >
            <AlertTriangle className="size-3" aria-hidden />
            Menos de 2 h
          </span>
        )}
      </div>
      <p className="num text-xs text-muted-foreground">
        {turn.createdByName ?? "—"} · {formatBogotaClock(turn.createdAt)}
      </p>
      {hasControls && (
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {turn.canAssign && (
            <Button
              variant="outline"
              className="h-11 px-3 md:h-9"
              disabled={pending}
              onClick={() => setAssigning((v) => !v)}
              aria-label={`${turn.vehicleId === null ? "Asignar vehículo a" : "Cambiar el vehículo de"} la solicitud ${label}`}
            >
              <Truck aria-hidden />
              {turn.vehicleId === null ? "Asignar" : "Cambiar"}
            </Button>
          )}
          {turn.canAssign && turn.vehicleId !== null && (
            <Button
              variant="outline"
              className="h-11 px-3 md:h-9"
              disabled={pending}
              onClick={() => run(() => assignTurnAction(turn.id, null))}
              aria-label={`Quitar el vehículo de la solicitud ${label}`}
            >
              Quitar vehículo
            </Button>
          )}
          {turn.canEdit && (
            <Button
              variant="outline"
              className="h-11 px-3 md:h-9"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
              aria-label={`Editar la solicitud ${label}`}
            >
              <Pencil aria-hidden />
              Editar
            </Button>
          )}
          {turn.canCancel && (
            <Button
              variant="destructive"
              className="h-11 px-3 md:h-9"
              disabled={pending}
              onClick={() => run(() => cancelTurnAction(turn.id))}
              aria-label={`Cancelar la solicitud ${label}`}
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
              aria-label={`Borrar la solicitud ${label}`}
              title="Borrar elimina la solicitud sin dejar rastro; Cancelar deja registro."
            >
              <Trash2 aria-hidden />
              Borrar
            </Button>
          )}
        </div>
      )}
      {editing && turn.canEdit && <EditForm turn={turn} onDone={onDone} onClose={() => setEditing(false)} />}
      {assigning && turn.canAssign && (
        <AssignPanel turn={turn} vehicles={vehicles} onDone={onDone} onClose={() => setAssigning(false)} />
      )}
      {turn.canDelete && confirmingDelete && (
        <div
          role="alertdialog"
          aria-label={`Confirmar el borrado de la solicitud ${label}`}
          className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-destructive-soft p-2 text-sm"
        >
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

/** All the requests of the day by needed hour, with the vehicle assigned (or Pendiente) and their status. */
export function TurnQueue({
  turns,
  vehicles,
  onDone,
}: {
  turns: readonly TurnView[];
  vehicles: ReadonlyArray<Vehicle>;
  onDone: (message: string) => void;
}) {
  if (turns.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún no hay solicitudes.</p>;
  }
  return (
    <ol className="space-y-2" aria-label="Solicitudes del día">
      {turns.map((turn) => (
        <TurnItem key={turn.id} turn={turn} vehicles={vehicles} onDone={onDone} />
      ))}
    </ol>
  );
}
