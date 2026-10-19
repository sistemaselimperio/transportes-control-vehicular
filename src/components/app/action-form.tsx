"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";

/** Labelled form control. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm text-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Form that submits its FormData to a server action and reports back:
 * inline error on failure, `onDone(message)` on success.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Guardando…",
  onDone,
  onCancel,
  children,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel?: string;
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
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11 px-4 md:h-10" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
