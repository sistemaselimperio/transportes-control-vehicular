"use client";

import { Download, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  type GroupFilter,
  type StatusFilter,
  type VehicleFilters,
} from "../domain/vehicle-filters";

const GROUPS: Array<{ value: GroupFilter; label: string }> = [
  { value: "", label: "Todos los grupos" },
  { value: "IMPERIO", label: "Imperio" },
  { value: "PAEZ", label: "Páez" },
  { value: "THIRD_PARTY", label: "Terceros" },
  { value: "NONE", label: "Sin propietario" },
];

const STATUSES: Array<{ value: StatusFilter; label: string }> = [
  { value: "NOT_SOLD", label: "Todos menos vendidos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "IDLE", label: "Quietas" },
  { value: "IN_WORKSHOP", label: "En taller" },
  { value: "SOLD", label: "Vendidos" },
  { value: "ALL", label: "Todos (con vendidos)" },
];

export const SORT_OPTIONS = [
  { value: "status:desc", label: "Más urgentes primero" },
  { value: "plate:asc", label: "Placa (A-Z)" },
  { value: "className:asc", label: "Clase (A-Z)" },
  { value: "owner:asc", label: "Propietario (A-Z)" },
  { value: "soat:asc", label: "SOAT que vence primero" },
  { value: "tecno:asc", label: "Tecno que vence primero" },
] as const;

interface Props {
  filters: VehicleFilters;
  onChange: (next: VehicleFilters) => void;
  owners: string[];
  classes: string[];
  shown: number;
  total: number;
  /** Mobile sort control (the table sorts with its headers). */
  sortValue: string;
  onSortChange: (value: string) => void;
  onExport: () => void;
  exporting: boolean;
  exportError: string | null;
}

export function VehicleFiltersBar({
  filters,
  onChange,
  owners,
  classes,
  shown,
  total,
  sortValue,
  onSortChange,
  onExport,
  exporting,
  exportError,
}: Props) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="vehicle-search" className="sr-only">
            Buscar por placa o conductor
          </Label>
          <Input
            id="vehicle-search"
            type="search"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Buscar placa o conductor"
            className="h-10 pl-8 md:h-8"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3 md:hidden"
          aria-expanded={open}
          aria-controls="vehicle-filters"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden />
          Filtros
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3 md:h-8"
          onClick={onExport}
          disabled={exporting || shown === 0}
        >
          <Download aria-hidden />
          <span className="hidden sm:inline">{exporting ? "Exportando…" : "Exportar Excel"}</span>
          <span className="sm:hidden">{exporting ? "…" : "Excel"}</span>
        </Button>
      </div>

      <div
        id="vehicle-filters"
        className={cn(
          "grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end",
          open ? "grid" : "hidden md:grid",
        )}
      >
        <Field label="Grupo">
          <NativeSelect
            value={filters.group}
            onChange={(e) => set("group", e.target.value as GroupFilter)}
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Propietario">
          <NativeSelect value={filters.owner} onChange={(e) => set("owner", e.target.value)}>
            <option value="">Todos</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Clase">
          <NativeSelect
            value={filters.className}
            onChange={(e) => set("className", e.target.value)}
          >
            <option value="">Todas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Estado">
          <NativeSelect
            value={filters.status}
            onChange={(e) => set("status", e.target.value as StatusFilter)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex min-h-10 items-center gap-2 text-sm md:min-h-8">
          <input
            type="checkbox"
            checked={filters.onlyAlerts}
            onChange={(e) => set("onlyAlerts", e.target.checked)}
            className="size-5 md:size-4"
          />
          Solo con alertas
        </label>
        <div className="md:hidden">
          <Field label="Ordenar por">
            <NativeSelect value={sortValue} onChange={(e) => onSortChange(e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">
          {shown} de {total} vehículos
        </span>
        {dirty && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
            Limpiar filtros
          </Button>
        )}
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
