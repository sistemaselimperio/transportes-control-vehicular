"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoticeToast, useNotice } from "@/modules/logbook/ui/notice";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";

const CONFIRM_WORD = "ELIMINAR";

/**
 * "Eliminar todos" for a list header: a destructive button (off while the list is empty) that opens
 * a confirmation stating what goes. Typing ELIMINAR arms the confirm button; the action takes no
 * ids, the server decides what to remove.
 */
export function DeleteAllButton({
  count,
  title,
  action,
  children,
}: {
  /** Rows the list holds now; the button is disabled at zero. */
  count: number;
  /** Panel title, e.g. "Eliminar todos los vehículos". */
  title: string;
  action: () => Promise<ActionResult>;
  /** What will be removed and what stays, shown in the warning box. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, notify] = useNotice();
  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setOpen(false);
    setTyped("");
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        close();
        notify({ tone: "ok", text: result.message });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="h-11 px-4 md:h-10"
        disabled={count === 0}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Eliminar todos
      </Button>

      <NoticeToast notice={notice} />

      <SlideOver open={open} onOpenChange={(next) => !pending && (next ? setOpen(true) : close())} title={title}>
        <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
            <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="space-y-1">
                {children}
                <p className="text-muted-foreground">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <Field label={`Escribe ${CONFIRM_WORD} para confirmar`} htmlFor="delete-all-confirm">
              <Input
                id="delete-all-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={pending}
                className="h-11 uppercase md:h-9"
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" className="h-11 px-4 md:h-9" disabled={pending} onClick={close}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 px-4 md:h-9"
              disabled={!armed || pending}
              onClick={confirm}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? "Eliminando…" : "Eliminar todos"}
            </Button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}
