"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { changeStatusBulkAction } from "../application/vehicle-actions";

const TARGETS = [
  { value: "ACTIVE", label: "Activa" },
  { value: "IDLE", label: "Quieta" },
  { value: "IN_WORKSHOP", label: "En taller" },
] as const;

/**
 * Appears while vehicles are selected in the fleet list: sets the same status on all of them in
 * one go. Sold vehicles cannot be selected, and "Vendido" is never offered (sales have their own flow).
 */
export function FleetBulkBar({
  plates,
  onClear,
}: {
  plates: readonly string[];
  /** Called after a successful change, and by "Quitar selección". */
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (plates.length === 0 && !message) return null;

  function apply(status: (typeof TARGETS)[number]) {
    setMessage(null);
    startTransition(async () => {
      const result = await changeStatusBulkAction({ plates: [...plates], status: status.value });
      if (result.ok) {
        setMessage({ tone: "ok", text: result.message });
        onClear();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <div
      role="region"
      aria-label="Cambiar estado de los vehículos seleccionados"
      aria-busy={pending}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-secondary/60 px-3 py-2"
    >
      {plates.length > 0 && (
        <>
          <p className="num text-sm font-medium">
            {plates.length} {plates.length === 1 ? "seleccionado" : "seleccionados"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Poner en</span>
            {TARGETS.map((t) => (
              <Button
                key={t.value}
                type="button"
                variant="outline"
                className="h-11 bg-background md:h-8"
                disabled={pending}
                onClick={() => apply(t)}
              >
                {t.label}
              </Button>
            ))}
            <Button type="button" variant="ghost" className="h-11 md:h-8" disabled={pending} onClick={onClear}>
              Quitar selección
            </Button>
          </div>
        </>
      )}
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "text-sm text-danger-foreground" : "text-sm text-ok-foreground"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
