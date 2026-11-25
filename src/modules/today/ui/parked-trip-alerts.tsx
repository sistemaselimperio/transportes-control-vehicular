"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import type { ParkedTripWarning } from "@/modules/dashboard/domain/parked-trips";
import { changeStatusAction } from "@/modules/vehicles/application/vehicle-actions";
import { formatTripDateTime } from "@/modules/trips/domain/trip-datetime";

const STATUS_TEXT = { IDLE: "Quieta", IN_WORKSHOP: "En taller" } as const;

function WarningRow({
  warning,
  canEdit,
  onDone,
}: {
  warning: ParkedTripWarning;
  canEdit: boolean;
  onDone: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function activate() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("status", "ACTIVE");
      const result = await changeStatusAction(warning.plate, fd);
      if (result.ok) onDone(`${warning.plate}: estado Activo.`);
      else setError(result.error);
    });
  }

  const route = [warning.origin, warning.destination].filter(Boolean).join(" → ");

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <Link
        href={`/flota/${encodeURIComponent(warning.plate)}`}
        className="inline-flex rounded-[5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        title={`Ver la ficha de ${warning.plate}`}
      >
        <span className="plate"><PlateText plate={warning.plate} /></span>
      </Link>
      <div className="min-w-0 flex-1 basis-56 text-sm">
        <p className="truncate font-medium">{route}</p>
        <p className="text-xs text-muted-foreground">
          Viaje programado el <span className="num">{formatTripDateTime(warning.startAt)}</span> · vehículo{" "}
          {STATUS_TEXT[warning.vehicleStatus].toLowerCase()}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger-foreground">
            {error}
          </p>
        )}
      </div>
      {canEdit && (
        <Button type="button" variant="outline" className="h-11 md:h-8" disabled={pending} onClick={activate}>
          {pending ? "Guardando…" : "Poner Activa"}
        </Button>
      )}
    </li>
  );
}

/**
 * "Vehículo quieto con viaje programado": shown only to users flagged to receive it. The list is
 * derived from current data, so a row leaves once its vehicle is active again.
 */
export function ParkedTripAlerts({
  warnings,
  canEdit,
  onDone,
}: {
  warnings: readonly ParkedTripWarning[];
  canEdit: boolean;
  onDone: (message: string) => void;
}) {
  if (warnings.length === 0) return null;
  return (
    <section aria-labelledby="parked-trips-title" className="overflow-hidden rounded-xl border border-warn-foreground/30 bg-warn/30">
      <h2
        id="parked-trips-title"
        className="flex items-center gap-2 border-b border-warn-foreground/20 px-4 py-2.5 text-sm font-semibold text-warn-foreground"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        Vehículo quieto con viaje programado
        <span className="num font-normal">({warnings.length})</span>
      </h2>
      <ul className="divide-y divide-warn-foreground/15">
        {warnings.map((w) => (
          <WarningRow key={w.tripId} warning={w} canEdit={canEdit} onDone={onDone} />
        ))}
      </ul>
    </section>
  );
}
