"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { DestinationRow } from "../application/delivery-queries";
import { formatBags, formatKg, formatTons } from "../domain/delivery-format";
import {
  DELIVERY_SHIFTS,
  filterDeliveries,
  isDeliveryShift,
  totalsOf,
  type DeliveryFilters,
  type DeliveryRow,
} from "../domain/delivery-rules";
import { DeliveryTable } from "./delivery-table";

/** Rows drawn at once; the filters and the stats always cover every match. */
const MAX_ROWS = 300;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="micro-label">{label}</p>
      <p className="num mt-1.5 text-lg font-semibold">{value}</p>
    </div>
  );
}

/** "Historial": every delivery with filters by client or NIT, destination, shift and date range, plus the stats of the matches. */
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
  const [filters, setFilters] = useState<DeliveryFilters>({ query: "", destinationId: null, shift: null, from: null, to: null });
  const shown = useMemo(() => filterDeliveries(rows, filters), [rows, filters]);
  const totals = useMemo(() => totalsOf(shown), [shown]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="history-query" className="sr-only">
            Buscar por cliente o NIT
          </Label>
          <Input
            id="history-query"
            type="search"
            value={filters.query}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder="Cliente o NIT"
            className="h-11 pl-9 md:h-9"
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="history-destination" className="sr-only">
            Filtrar por destino
          </Label>
          <NativeSelect
            id="history-destination"
            className="h-11 md:h-9"
            value={filters.destinationId ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, destinationId: e.target.value === "" ? null : Number(e.target.value) }))}
          >
            <option value="">Todos los destinos</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="history-shift" className="sr-only">
            Filtrar por turno
          </Label>
          <NativeSelect
            id="history-shift"
            className="h-11 md:h-9"
            value={filters.shift ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, shift: isDeliveryShift(e.target.value) ? e.target.value : null }))}
          >
            <option value="">Todos los turnos</option>
            {DELIVERY_SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="history-from" className="mb-1 block text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="history-from"
            type="date"
            className="h-11 md:h-9"
            value={filters.from ?? ""}
            max={filters.to ?? undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
          />
        </div>
        <div>
          <Label htmlFor="history-to" className="mb-1 block text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="history-to"
            type="date"
            className="h-11 md:h-9"
            value={filters.to ?? ""}
            min={filters.from ?? undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
          />
        </div>
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
