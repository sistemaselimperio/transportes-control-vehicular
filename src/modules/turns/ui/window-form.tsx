"use client";

import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDayAction, updateWindowAction } from "../application/turn-actions";
import { useTurnAction } from "./use-turn-action";

const FIELD = "h-10 md:h-9";

/**
 * The opening and closing hours of a jornada (Bogotá). With `dayId` it edits that jornada (extend, close
 * early, reopen); without it, it creates the jornada of `date`.
 */
export function WindowForm({
  date,
  dayId,
  opensTime,
  closesTime,
  onDone,
  onCancel,
}: {
  date: string;
  dayId?: number;
  opensTime: string;
  closesTime: string;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const { run, pending, error } = useTurnAction(onDone);
  const editing = dayId !== undefined;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => (editing ? updateWindowAction(dayId, fd) : createDayAction(fd)), onCancel);
      }}
    >
      <input type="hidden" name="date" value={date} />
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <Field label="Abre" htmlFor="turn-opens" required>
          <Input id="turn-opens" name="opensTime" type="time" className={FIELD} defaultValue={opensTime} required />
        </Field>
        <Field label="Cierra" htmlFor="turn-closes" required>
          <Input id="turn-closes" name="closesTime" type="time" className={FIELD} defaultValue={closesTime} required />
        </Field>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-11 px-4 md:h-9" disabled={pending}>
          {pending ? "Guardando…" : editing ? "Guardar horario" : "Crear jornada"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" className="h-11 px-4 md:h-9" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
