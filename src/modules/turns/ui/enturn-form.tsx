"use client";

import { useRef } from "react";
import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enturnAction } from "../application/turn-actions";
import { PLACE_MAX, PRODUCT_MAX } from "../application/turn-schemas";
import { useTurnAction } from "./use-turn-action";

const FIELD = "h-10 md:h-9";

/** Creates a request: product, place and needed hour. The vehicle is assigned later by an admin. The server checks the window again. */
export function EnturnForm({ turnDayId, onDone }: { turnDayId: number; onDone: (message: string) => void }) {
  const { run, pending, error } = useTurnAction(onDone);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => enturnAction(fd),
          () => formRef.current?.reset(),
        );
      }}
    >
      <input type="hidden" name="turnDayId" value={turnDayId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,8rem)_auto] sm:items-end">
        <Field label="Producto" htmlFor="turn-product" required>
          <Input
            id="turn-product"
            name="product"
            className={FIELD}
            maxLength={PRODUCT_MAX}
            autoComplete="off"
            required
            placeholder="¿Qué se necesita?"
          />
        </Field>
        <Field label="Lugar" htmlFor="turn-place" required>
          <Input
            id="turn-place"
            name="destination"
            className={FIELD}
            maxLength={PLACE_MAX}
            autoComplete="off"
            required
            placeholder="¿A dónde?"
          />
        </Field>
        <Field label="Hora" htmlFor="turn-hour" required>
          <Input id="turn-hour" name="neededTime" type="time" className={FIELD} required />
        </Field>
        <Button type="submit" className="h-11 px-4 md:h-9" disabled={pending}>
          {pending ? "Enviando…" : "Solicitar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">La solicitud queda pendiente hasta que Leidy le asigne un vehículo.</p>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
