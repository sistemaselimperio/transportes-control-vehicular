"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NO_OWNER, THIRD_PARTY_OWNER, type OwnerOption, type VehicleFilters } from "../domain/vehicle-filters";

export const SORT_OPTIONS = [
  { value: "status:desc", label: "Más urgentes primero" },
  { value: "plate:asc", label: "Placa (A-Z)" },
  { value: "className:asc", label: "Clase (A-Z)" },
  { value: "owner:asc", label: "Propietario (A-Z)" },
  { value: "soat:asc", label: "SOAT que vence primero" },
  { value: "tecno:asc", label: "Tecno que vence primero" },
] as const;

type EditableFilters = Pick<VehicleFilters, "search" | "owner" | "className">;

interface Props {
  filters: EditableFilters;
  onChange: (next: Partial<EditableFilters>) => void;
  onClear: () => void;
  owners: OwnerOption[];
  classes: string[];
  sortValue: string;
  onSortChange: (value: string) => void;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="micro-label">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Compact bar: search always, the rest inline from `md` and in a sheet on phones. */
export function VehicleFiltersBar({
  filters,
  onChange,
  onClear,
  owners,
  classes,
  sortValue,
  onSortChange,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const dirty = Boolean(filters.search || filters.owner || filters.className);

  const selects = (suffix: string) => (
    <>
      <Field label="Clase" htmlFor={`filter-class${suffix}`}>
        <NativeSelect
          id={`filter-class${suffix}`}
          value={filters.className}
          onChange={(e) => onChange({ className: e.target.value })}
          className="h-11 md:h-9"
        >
          <option value="">Todas</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Propietario" htmlFor={`filter-owner${suffix}`}>
        <NativeSelect
          id={`filter-owner${suffix}`}
          value={filters.owner}
          onChange={(e) => onChange({ owner: e.target.value })}
          className="h-11 md:h-9"
        >
          <option value="">Todos</option>
          {owners.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={THIRD_PARTY_OWNER}>Terceros</option>
          <option value={NO_OWNER}>Sin propietario</option>
        </NativeSelect>
      </Field>
      <Field label="Ordenar por" htmlFor={`filter-sort${suffix}`}>
        <NativeSelect
          id={`filter-sort${suffix}`}
          value={sortValue}
          onChange={(e) => onSortChange(e.target.value)}
          className="h-11 md:h-9"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-xs md:flex-none md:basis-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="vehicle-search" className="sr-only">
            Buscar por placa o conductor
          </Label>
          <Input
            id="vehicle-search"
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Buscar placa o conductor"
            className="h-11 pl-9 md:h-9"
            autoComplete="off"
          />
        </div>

        {/* Inline from md */}
        <div className="hidden items-end gap-2 md:flex [&_select]:min-w-40">{selects("")}</div>

        <Button
          type="button"
          variant="outline"
          className="h-11 px-3 md:hidden"
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal aria-hidden />
          Filtros
        </Button>
        {dirty && (
          <Button type="button" variant="ghost" className="hidden h-9 px-3 md:inline-flex" onClick={onClear}>
            Limpiar
          </Button>
        )}
      </div>

      <SlideOver open={sheetOpen} onOpenChange={setSheetOpen} title="Filtros y orden">
        <div className="space-y-4">
          {selects("-sheet")}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={onClear}
              disabled={!dirty}
            >
              Limpiar filtros
            </Button>
            <Button type="button" className="h-11 px-4" onClick={() => setSheetOpen(false)}>
              Listo
            </Button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
