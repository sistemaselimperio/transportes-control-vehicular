"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { DestinationRow } from "../application/delivery-queries";
import { formatBags, formatKg, formatTons } from "../domain/delivery-format";
import {
  DELIVERY_SHIFTS,
  filterDeliveries,
  isDeliveryShift,
  shiftLabel,
  totalsOf,
  type DeliveryFilters,
  type DeliveryRow,
} from "../domain/delivery-rules";
import { DeliveryTable } from "./delivery-table";

/** Rows drawn at once; the filters and the stats always cover every match. */
const MAX_ROWS = 300;

const EMPTY_FILTERS: DeliveryFilters = { query: "", destinationId: null, shift: null, from: null, to: null };
const LABEL = "mb-1.5 block text-xs font-medium text-muted-foreground";
const CONTROL = "h-11 bg-card md:h-9";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="micro-label">{label}</p>
      <p className="num mt-1.5 text-lg font-semibold">{value}</p>
    </div>
  );
}

/** "Historial": every delivery with filters by client or NIT, destination, trip and date range, plus the stats of the matches. */
export function DeliveryHistory({
  rows,
  destinations,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: readonly DeliveryRow[];
  destinations: readonly DestinationRow[];
  canManage: boolean;
  onEdit: (row: DeliveryRow) => void;
  onDelete: (row: DeliveryRow) => void;
}) {
  const [filters, setFilters] = useState<DeliveryFilters>(EMPTY_FILTERS);
  const active =
    filters.query.trim() !== "" || filters.destinationId !== null || filters.shift !== null || filters.from !== null || filters.to !== null;
  const shown = useMemo(() => filterDeliveries(rows, filters), [rows, filters]);
  const totals = useMemo(() => totalsOf(shown), [shown]);

  return (
    <div className="space-y-4">
      {/* Every control has a visible label, so the whole row lines up on one baseline. */}
      <div
        role="search"
        aria-label="Filtros del historial"
        className="grid items-end gap-3 rounded-2xl bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_auto]"
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="history-query" className={LABEL}>
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="history-query"
              type="search"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="Cliente o NIT"
              className={`${CONTROL} pl-9`}
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="history-destination" className={LABEL}>
            Destino
          </Label>
          <NativeSelect
            id="history-destination"
            className={CONTROL}
            value={filters.destinationId ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, destinationId: e.target.value === "" ? null : Number(e.target.value) }))}
          >
            <option value="">Todos</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="history-shift" className={LABEL}>
            Viaje
          </Label>
          <NativeSelect
            id="history-shift"
            className={CONTROL}
            value={filters.shift ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, shift: isDeliveryShift(e.target.value) ? e.target.value : null }))}
          >
            <option value="">Todos</option>
            {DELIVERY_SHIFTS.map((s) => (
              <option key={s} value={s}>
                {shiftLabel(s)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <fieldset className="min-w-0 sm:col-span-2 lg:col-span-1">
          <legend className={LABEL}>Fechas</legend>
          <div className="flex items-center gap-2">
            <Label htmlFor="history-from" className="sr-only">
              Desde
            </Label>
            <Input
              id="history-from"
              type="date"
              className={`${CONTROL} min-w-0 flex-1`}
              value={filters.from ?? ""}
              max={filters.to ?? undefined}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
            />
            <span className="shrink-0 text-sm text-muted-foreground" aria-hidden>
              a
            </span>
            <Label htmlFor="history-to" className="sr-only">
              Hasta
            </Label>
            <Input
              id="history-to"
              type="date"
              className={`${CONTROL} min-w-0 flex-1`}
              value={filters.to ?? ""}
              min={filters.from ?? undefined}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
            />
          </div>
        </fieldset>
        <Button
          variant="ghost"
          className={`${CONTROL} px-3 sm:col-span-2 lg:col-span-1 ${active ? "" : "invisible"}`}
          onClick={() => setFilters(EMPTY_FILTERS)}
          aria-hidden={!active}
          tabIndex={active ? undefined : -1}
        >
          <X aria-hidden />
          Limpiar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-live="polite">
        <Stat label="Entregas" value={String(totals.count)} />
        <Stat label="Bultos" value={formatBags(totals.quantity)} />
        <Stat label="Kilogramos" value={formatKg(totals.weightKg)} />
        <Stat label="Toneladas" value={formatTons(totals.weightKg)} />
      </div>

      <DeliveryTable
        rows={shown.slice(0, MAX_ROWS)}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No hay entregas para este filtro."
      />
      {shown.length > MAX_ROWS && (
        <p className="text-sm text-muted-foreground">
          Se muestran las {MAX_ROWS} más recientes de {shown.length}. Ajusta los filtros para ver el resto.
        </p>
      )}
    </div>
  );
}
