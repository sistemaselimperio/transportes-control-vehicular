"use client";

import { CircleCheck, Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { setDeliveryStatusAction } from "../application/delivery-actions";
import { formatBags, formatKg, formatTons } from "../domain/delivery-format";
import { groupByVehicle, shiftLabel, totalsOf, type DeliveryRow, type DeliveryTotals } from "../domain/delivery-rules";
import { DeliveryPriorityBadge } from "./delivery-badges";

export function TotalsLine({ totals, className }: { totals: DeliveryTotals; className?: string }) {
  return (
    <p className={cn("num text-sm text-muted-foreground", className)}>
      {totals.count} {totals.count === 1 ? "entrega" : "entregas"} · {formatBags(totals.quantity)} bultos ·{" "}
      {formatKg(totals.weightKg)} kg · {formatTons(totals.weightKg)} t
    </p>
  );
}

/** Marks one delivery as entregado, or back to pendiente. */
function StatusToggle({ row, onDone }: { row: DeliveryRow; onDone: (message: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const delivered = row.status === "entregado";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setDeliveryStatusAction(row.id, delivered ? "pendiente" : "entregado");
      if (result.ok) onDone(result.message);
      else setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        variant={delivered ? "outline" : "default"}
        className="h-11 px-3 md:h-9"
        onClick={toggle}
        disabled={pending}
        aria-pressed={delivered}
        aria-label={`${delivered ? "Marcar como pendiente" : "Marcar como entregada"}: ${row.clientName}`}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : delivered ? <Undo2 aria-hidden /> : <CircleCheck aria-hidden />}
        {delivered ? "Deshacer" : "Entregar"}
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** "Hoy": today's deliveries grouped by vehicle and then by trip, urgent first, with the pendiente / entregado toggle. */
export function DeliveryToday({
  rows,
  canManage,
  onDone,
}: {
  /** Only the deliveries dated today. */
  rows: readonly DeliveryRow[];
  canManage: boolean;
  onDone: (message: string) => void;
}) {
  const groups = groupByVehicle(rows);
  const total = totalsOf(rows);
  const pending = rows.filter((r) => r.status === "pendiente").length;

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="plate-head">
          <span className="micro-label">Total del día</span>
        </div>
        <div className="space-y-1 p-4">
          <TotalsLine totals={total} className="text-base text-foreground" />
          <p className="num text-sm text-muted-foreground" aria-live="polite">
            {rows.length === 0
              ? "Sin entregas para hoy."
              : pending === 0
                ? "Todas entregadas."
                : `${pending} ${pending === 1 ? "pendiente" : "pendientes"}`}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <section key={group.plate ?? "none"} aria-label={group.plate ? `Vehículo ${group.plate}` : "Sin vehículo"} className="panel">
            <div className="plate-head">
              <h2 className={cn("micro-label", group.plate && "num")}>{group.plate ?? "Sin vehículo"}</h2>
            </div>
            <div className="border-b px-4 py-2">
              <TotalsLine totals={group.totals} />
            </div>
            {group.trips.map((trip) => (
              <div key={trip.shift} className="border-b last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 bg-muted/40 px-4 py-2">
                  <h3 className="text-sm font-semibold">{shiftLabel(trip.shift)}</h3>
                  <TotalsLine totals={trip.totals} className="text-xs" />
                </div>
                {trip.rows.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Sin entregas en este viaje.</p>
                ) : (
                  <ul className="divide-y">
                    {trip.rows.map((r) => (
                      <li
                        key={r.id}
                        className={cn(
                          "flex items-start justify-between gap-3 px-4 py-3",
                          r.priority === "urgente" && "border-l-4 border-destructive bg-destructive-faint",
                          r.status === "entregado" && "opacity-70",
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className={cn("font-medium", r.status === "entregado" && "line-through")}>{r.clientName}</p>
                          <p className="text-sm text-muted-foreground">
                            {r.locationName && <>Finca {r.locationName} · </>}
                            {r.destinationName}
                            {r.clientNit && <span className="num"> · {formatNit(r.clientNit)}</span>}
                          </p>
                          <p className="num text-sm">
                            {formatBags(r.quantity)} bultos · {formatKg(r.weightKg)} kg · {formatTons(r.weightKg)} t
                          </p>
                          {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                          <div className="flex flex-wrap items-center gap-2">
                            <DeliveryPriorityBadge priority={r.priority} />
                          </div>
                        </div>
                        {canManage && <StatusToggle row={r} onDone={onDone} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
