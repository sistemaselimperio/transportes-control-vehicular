"use client";

import { CheckCircle2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { TRIP_AREAS, isTripArea } from "../domain/trip-areas";
import { filterTrips, type TripFilters, type TripRow } from "../domain/trip-row";
import { isTripStatus, TRIP_STATUS_LABELS, TRIP_STATUSES } from "../domain/trip-status";
import { DeleteTripDialog } from "./delete-trip-dialog";
import { TripForm } from "./trip-form";
import { TripList } from "./trip-list";

const STATUS_CHIPS: ReadonlyArray<{ value: TripFilters["status"]; label: string }> = [
  { value: "ALL", label: "Todos" },
  ...TRIP_STATUSES.map((s) => ({ value: s, label: TRIP_STATUS_LABELS[s] })),
];

/** Trips page: filters, the list, the create / edit side sheet and the delete confirmation (only with `canManage`). */
export function TripsView({
  rows,
  plates,
  canManage,
  initialQuery = "",
}: {
  rows: readonly TripRow[];
  plates: readonly string[];
  /** False for a read-only role: no create, edit or delete controls. */
  canManage: boolean;
  /** Seeds the search box (e.g. the plate of `?placa=`); filtering stays client-side. */
  initialQuery?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TripRow | undefined>();
  const [deleting, setDeleting] = useState<TripRow | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<TripFilters>({ status: "ALL", area: "ALL", query: initialQuery });
  const shown = useMemo(() => filterTrips(rows, filters), [rows, filters]);

  const openForm = (trip?: TripRow) => {
    setMessage(null);
    setEditing(trip);
    setOpen(true);
  };
  const done = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 6000);
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Viajes"
        description="Viajes programados y entregados de la flota."
        actions={
          canManage && (
            <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
              <Plus aria-hidden />
              Nuevo viaje
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-0 flex-1 md:max-w-md md:flex-none md:basis-96">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="trip-search" className="sr-only">
            Buscar viaje por placa o destino
          </Label>
          <Input
            id="trip-search"
            type="search"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="Buscar placa o destino"
            className="h-11 pl-9 md:h-9"
            autoComplete="off"
          />
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="trip-area-filter" className="sr-only">
            Filtrar por área
          </Label>
          <NativeSelect
            id="trip-area-filter"
            className="h-11 md:h-9"
            value={filters.area}
            onChange={(e) =>
              setFilters((f) => ({ ...f, area: isTripArea(e.target.value) ? e.target.value : "ALL" }))
            }
          >
            <option value="ALL">Todas las áreas</option>
            {TRIP_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((chip) => {
            const selected = filters.status === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    status: chip.value === "ALL" || isTripStatus(chip.value) ? chip.value : "ALL",
                  }))
                }
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-sm text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 md:min-h-9",
                  selected && "border-transparent bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {shown.length} de {rows.length} viajes
        </p>
      </div>

      <TripList rows={shown} canManage={canManage} onEdit={openForm} onDelete={setDeleting} />

      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground shadow-soft"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      <DeleteTripDialog trip={deleting} onClose={() => setDeleting(undefined)} onDone={done} />

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar viaje" : "Nuevo viaje"}
        description={editing && `${editing.plate} · ${editing.destination}`}
      >
        <TripForm
          trip={editing}
          plates={plates}
          onCancel={() => setOpen(false)}
          onDone={(msg) => {
            done(msg);
            setOpen(false);
          }}
        />
      </SlideOver>
    </section>
  );
}
