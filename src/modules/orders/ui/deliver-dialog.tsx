"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";

/** What is being delivered: the orders (or the load) and the action that stores the delivery on a day. */
export interface DeliverTarget {
  /** Identifies the target, so the form starts over (today's date, no error) for each one. */
  key: string;
  title: string;
  description: string;
  /** What the confirmation says will happen. */
  summary: string;
  run: (date: string) => Promise<ActionResult>;
}

function DeliverForm({
  target,
  today,
  onClose,
  onDone,
}: {
  target: DeliverTarget;
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await target.run(date);
      if (result.ok) {
        onDone(result.message);
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        <p className="text-sm">{target.summary}</p>
        <div>
          <Label htmlFor="delivery-date" className="mb-1 block text-xs text-muted-foreground">
            Fecha de entrega
          </Label>
          <Input
            id="delivery-date"
            type="date"
            className="h-11 md:h-9"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" className="h-11 px-4 md:h-9" disabled={pending} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" className="h-11 px-4 md:h-9" disabled={pending || date === ""} onClick={confirm}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? "Entregando…" : "Entregar"}
        </Button>
      </div>
    </div>
  );
}

/** Small confirmation to mark orders as delivered: the day defaults to today in Colombia. */
export function DeliverDialog({
  target,
  today,
  onClose,
  onDone,
}: {
  target: DeliverTarget | undefined;
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <SlideOver
      open={target !== undefined}
      onOpenChange={(next) => !next && onClose()}
      title={target?.title ?? "Entregar"}
      description={target?.description}
    >
      {target && <DeliverForm key={target.key} target={target} today={today} onClose={onClose} onDone={onDone} />}
    </SlideOver>
  );
}

/** "Deshacer entrega": runs the action at once and reports the result (or the refusal) in the flash message. */
export function UndoDeliveryButton({
  run,
  onDone,
  label,
  className,
}: {
  run: () => Promise<ActionResult>;
  onDone: (message: string) => void;
  /** Accessible name, naming the order or the load. */
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await run();
          onDone(result.ok ? result.message : result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
      <span className="max-sm:sr-only">Deshacer entrega</span>
    </Button>
  );
}
