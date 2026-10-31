"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { deleteDriverAction } from "../application/driver-actions";
import type { DriverRow } from "../domain/driver-row";

/** In-app confirmation to delete one driver; the server refuses while the driver has a vehicle. */
export function DeleteDriverDialog({
  driver,
  onClose,
  onDone,
}: {
  /** The driver to delete; the dialog is closed while this is undefined. */
  driver: DriverRow | undefined;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    onClose();
  }

  function confirm() {
    if (!driver) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDriverAction(driver.id);
      if (result.ok) {
        onDone(result.message);
        close();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <SlideOver
      open={driver !== undefined}
      onOpenChange={(next) => !pending && !next && close()}
      title="Eliminar conductor"
      description={driver?.name}
    >
      <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Se eliminará a {driver?.name}.</p>
              <p className="text-muted-foreground">
                Se borra también su historial de asignaciones. Los vehículos no se eliminan. Esta acción no se
                puede deshacer.
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
  );
}
