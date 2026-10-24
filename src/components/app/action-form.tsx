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
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  /** Visual marker only; the control itself still carries `required`. */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="gap-1 text-sm text-foreground">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
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
  destructive = false,
  onDone,
  onCancel,
  children,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel?: string;
  /** Draws the submit button as destructive, for irreversible actions. */
  destructive?: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-slot="action-form"
      className="flex min-h-0 flex-1 flex-col"
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
      {/* Only the fields scroll; the panel body drops its own padding and scroll for us (see SlideOver). */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
      {/*
        Action bar outside the scroll area, so Save is always in view. The
        error lives here too: at the end of a long form it would sit off-screen.
      */}
      <div className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant={destructive ? "destructive" : "default"}
            className="h-11 px-4 md:h-10"
            disabled={pending}
          >
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
