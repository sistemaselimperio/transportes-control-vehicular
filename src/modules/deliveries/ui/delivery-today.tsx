"use client";

import { CircleCheck, Clock, Loader2, MapPin, Minus, Plus, TriangleAlert, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { setDeliveryStatusAction } from "../application/delivery-actions";
import { formatBags, formatKg, formatTons } from "../domain/delivery-format";
import { groupByVehicle, shiftLabel, type DeliveryRow, type DeliveryTotals, type VehicleGroup } from "../domain/delivery-rules";

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

  // Sits at the right end of the row's footer, beside the load it confirms.
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {delivered ? (
        // Delivered: the state in words, with undo as a quiet secondary action.
        <span className="flex items-center gap-1">
          <span className="flex items-center gap-1 text-sm font-medium text-ok-foreground">
            <CircleCheck className="size-4" aria-hidden />
            Entregada
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground md:size-9"
            onClick={toggle}
            disabled={pending}
            title="Deshacer"
            aria-label={`Deshacer entrega: ${row.clientName}`}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
          </Button>
        </span>
      ) : (
        <Button
          className="h-11 px-4 font-semibold md:h-9"
          onClick={toggle}
          disabled={pending}
          aria-label={`Marcar como entregada: ${row.clientName}`}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
          Entregar
        </Button>
      )}
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type VehicleCardGroup = VehicleGroup<DeliveryRow>;

const STATUS_PILL = "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

/**
 * What is left for the vehicle, as pills that never count a delivery twice: the urgent ones, then the
 * other pending ones. Screen readers get one sentence instead of loose numbers.
 */
function VehicleStatus({ pending, urgent }: { pending: number; urgent: number }) {
  const normal = pending - urgent;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const sentence =
    pending === 0
      ? "Todas entregadas"
      : [urgent > 0 && plural(urgent, "urgente", "urgentes"), normal > 0 && plural(normal, "pendiente", "pendientes")]
          .filter(Boolean)
          .join(" y ") + " por entregar";

  return (
    <div role="status" aria-atomic="true" className="flex shrink-0 flex-col items-end gap-1">
      <span className="sr-only">{sentence}</span>
      {pending === 0 ? (
        <span aria-hidden className={cn(STATUS_PILL, "bg-ok text-ok-foreground ring-ok-foreground/20")}>
          <CircleCheck className="size-3.5" />
          Completo
        </span>
      ) : (
        <>
          {urgent > 0 && (
            <span aria-hidden className={cn(STATUS_PILL, "bg-destructive-soft text-destructive ring-destructive/20")}>
              <TriangleAlert className="size-3.5" />
              <span className="num">{urgent}</span> {urgent === 1 ? "urgente" : "urgentes"}
            </span>
          )}
          {normal > 0 && (
            <span aria-hidden className={cn(STATUS_PILL, "bg-muted text-muted-foreground ring-foreground/10")}>
              <Clock className="size-3.5" />
              <span className="num">{normal}</span> {normal === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The vehicle card's compact head: the plate chip (linked to its fleet page) and what is left, then
 * the day's load in one line, and a thin progress bar of delivered over total along the bottom edge.
 */
function VehicleHead({ group }: { group: VehicleCardGroup }) {
  const rows = group.trips.flatMap((t) => t.rows);
  const delivered = rows.filter((r) => r.status === "entregado").length;
  const pending = rows.length - delivered;
  const urgent = rows.filter((r) => r.priority === "urgente" && r.status === "pendiente").length;
  const vehicleId = rows.find((r) => r.vehicleId !== null)?.vehicleId ?? null;
  const percent = rows.length === 0 ? 0 : Math.round((delivered / rows.length) * 100);

  return (
    <div className="relative border-b px-4 pt-3 pb-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0">
          {group.plate === null ? (
            <span className="text-base font-semibold text-muted-foreground">Sin vehículo</span>
          ) : vehicleId === null ? (
            <span className="plate text-base">
              <PlateText plate={group.plate} />
            </span>
          ) : (
            <Link
              href={`/flota/${encodeURIComponent(group.plate)}`}
              className="plate text-base outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
              aria-label={`Vehículo ${group.plate}, ver en flota`}
            >
              <PlateText plate={group.plate} />
            </Link>
          )}
        </h2>
        <VehicleStatus pending={pending} urgent={urgent} />
      </div>
      <p className="num mt-1.5 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {delivered}/{rows.length}
        </span>{" "}
        {rows.length === 1 ? "entregada" : "entregadas"} · {formatBags(group.totals.quantity)} bultos ·{" "}
        {formatTons(group.totals.weightKg)} t
      </p>
      {/* Flush along the card's bottom edge, so it costs no height of its own. */}
      <div
        role="progressbar"
        aria-label="Entregas completadas"
        aria-valuemin={0}
        aria-valuemax={rows.length}
        aria-valuenow={delivered}
        aria-valuetext={`${delivered} de ${rows.length} entregadas`}
        className="absolute inset-x-0 bottom-0 h-1 bg-muted"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
            pending === 0 ? "bg-ok-foreground" : "bg-foreground/60",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** "Hoy":today's deliveries grouped by vehicle and then by trip, urgent first, with the pendiente / entregado toggle. */
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

  if (rows.length === 0) {
    return (
      <p className="panel px-4 py-8 text-center text-sm text-muted-foreground">Sin entregas para hoy.</p>
    );
  }

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <section key={group.plate ?? "none"} aria-label={group.plate ? `Vehículo ${group.plate}` : "Sin vehículo"} className="panel">
            <VehicleHead group={group} />
            {/* Only the trips this vehicle actually has today; empty ones are left out. */}
            {group.trips.filter((trip) => trip.rows.length > 0).map((trip) => {
              const tripPending = trip.rows.filter((r) => r.status === "pendiente").length;
              const tripUrgent = trip.rows.some((r) => r.priority === "urgente" && r.status === "pendiente");
              return (
              // Closed by default: the summary keeps the trip's totals and its state (urgent, pending, done) visible.
              <details key={trip.shift} className="smooth-details group/trip border-b last:border-b-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 bg-muted/40 px-4 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                  {/* "+" turns and fades into the "−" underneath when the trip opens. */}
                  <span className="relative size-4 shrink-0 text-muted-foreground" aria-hidden>
                    <Minus className="absolute inset-0 size-4" />
                    <Plus className="absolute inset-0 size-4 transition-[rotate,opacity] duration-200 ease-out group-open/trip:rotate-90 group-open/trip:opacity-0 motion-reduce:transition-none" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{shiftLabel(trip.shift)}</span>
                      {/* Icons only: the vehicle head above carries the counts in words. */}
                      {tripUrgent && (
                        <span title="Tiene entregas urgentes" className="inline-flex text-destructive">
                          <TriangleAlert className="size-4" aria-hidden />
                          <span className="sr-only">Tiene entregas urgentes</span>
                        </span>
                      )}
                      {tripPending > 0 ? (
                        <span title="Tiene entregas pendientes" className="inline-flex text-muted-foreground">
                          <Clock className="size-4" aria-hidden />
                          <span className="sr-only">Tiene entregas pendientes</span>
                        </span>
                      ) : (
                        <span title="Viaje completo" className="inline-flex text-ok-foreground">
                          <CircleCheck className="size-4" aria-hidden />
                          <span className="sr-only">Viaje completo</span>
                        </span>
                      )}
                    </span>
                    <TotalsLine totals={trip.totals} className="text-xs" />
                  </span>
                </summary>
                <ul className="divide-y">
                    {trip.rows.map((r) => (
                      <li
                        key={r.id}
                        className={cn(
                          "space-y-3 px-4 py-3",
                          r.priority === "urgente" && r.status === "pendiente" && "border-l-4 border-destructive bg-destructive-faint",
                        )}
                      >
                        <div className={cn("min-w-0 space-y-2", r.status === "entregado" && "opacity-60")}>
                          {/* The urgent mark gets its own column, so the name and the line under it share one left edge. */}
                          <div className="flex items-start gap-1.5">
                            {r.priority === "urgente" && (
                              <span title="Urgente" className="mt-0.5 inline-flex shrink-0 text-destructive">
                                <TriangleAlert className="size-4" aria-hidden />
                                <span className="sr-only">Urgente:</span>
                              </span>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <p
                                title={r.clientName}
                                className={cn(
                                  "line-clamp-2 text-[0.9375rem] leading-snug font-semibold break-words text-foreground",
                                  r.status === "entregado" && "line-through",
                                )}
                              >
                                {r.clientName}
                              </p>
                              {/* NIT and place side by side, every item on one 20px line box so they centre alike. */}
                              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.8125rem] leading-5 text-muted-foreground">
                                {r.clientNit && (
                                  <>
                                    <span className="num flex h-5 items-center whitespace-nowrap">NIT {formatNit(r.clientNit)}</span>
                                    <span className="h-3.5 w-px shrink-0 bg-foreground/20" aria-hidden />
                                  </>
                                )}
                                <span className="flex min-h-5 min-w-0 items-center gap-1">
                                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                                  <span className="min-w-0">
                                    {[r.locationName && `Finca ${r.locationName}`, r.destinationName].filter(Boolean).join(" · ")}
                                  </span>
                                </span>
                              </p>
                            </div>
                          </div>
                          {r.notes && <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-sm text-muted-foreground">{r.notes}</p>}
                        </div>
                        {/* The action closes the row at the right, where the reading ends. */}
                        {canManage && (
                          <div className="flex justify-end">
                            <StatusToggle row={r} onDone={onDone} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
              </details>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
