"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { deleteInspectionAction } from "../application/delete-inspection-action";

/**
 * Admin only: deletes one inspection after an in-app confirmation. `afterDelete` is where to go
 * once it is gone (the list, from the detail page); without it the current page just refreshes.
 */
export function DeleteInspectionButton({
  inspectionId,
  summary,
  afterDelete,
  iconOnly = false,
}: {
  inspectionId: string;
  /** What is being deleted, e.g. "SXT123 · 04/11/2026 06:15". */
  summary: string;
  afterDelete?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    setOpen(false);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteInspectionAction(inspectionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (afterDelete) router.push(afterDelete);
      else router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={iconOnly ? "ghost" : "outline"}
        className={iconOnly ? "size-11 p-0 text-destructive md:size-9" : "h-11 px-4 text-destructive md:h-10"}
        aria-label={iconOnly ? `Eliminar inspección ${summary}` : undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        {!iconOnly && "Eliminar"}
      </Button>

      <SlideOver
        open={open}
        onOpenChange={(next) => !pending && !next && close()}
        title="Eliminar inspección"
        description={summary}
      >
        <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
            <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="space-y-1">
                <p className="font-medium">Se eliminará la inspección {summary}.</p>
                <p className="text-muted-foreground">
                  Se borran también su firma, la decisión de salida y el cierre. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
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
            <Button type="button" variant="destructive" className="h-11 px-4 md:h-9" disabled={pending} onClick={confirm}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </div>
      </SlideOver>
    </>
  );
}
