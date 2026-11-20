"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";

/**
 * A form that lives inside a sheet section instead of owning the whole sheet: same contract as
 * ActionForm (server action, inline error, `onDone(message)`), but laid out in the page flow.
 */
export function InlineForm({
  action,
  submitLabel,
  onDone,
  onCancel,
  children,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  onDone: (message: string) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await action(fd);
          if (result.ok) onDone(result.message);
          else setError(result.error);
        });
      }}
    >
      {children}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-11 px-4 md:h-9" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11 px-4 md:h-9" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
