"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { normalizePlateKey } from "../domain/inspection-links";
import {
  EXIT_FILTER_OPTIONS,
  exitFilterParam,
  inspectionsHref,
  type ExitFilter,
  type InspectionFilters,
} from "../domain/inspection-filters";

/** Typing pauses this long before the plate filter is applied. */
const PLATE_DELAY_MS = 350;

type Fields = { plate: string; from: string; to: string; exit: ExitFilter };

const fieldsOf = (f: InspectionFilters): Fields => ({ plate: f.plate, from: f.from ?? "", to: f.to ?? "", exit: f.exit });

/**
 * Filters for the inspections list. Each change updates the URL right away (the plate after a short
 * pause), and the URL only carries the fields that have a value. Any change goes back to page 1; the
 * driver / vehicle filters that come from links elsewhere are kept. Without JavaScript it still
 * submits as a plain GET form.
 */
export function InspectionFiltersForm({ filters }: { filters: InspectionFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(() => fieldsOf(filters));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const hasFilter = Boolean(
    fields.plate || fields.from || fields.to || fields.exit !== "ALL" || filters.driverId || filters.vehicleId,
  );

  function apply(next: Fields, keepLinks = true) {
    if (timer.current) clearTimeout(timer.current);
    const href = inspectionsHref({
      plate: normalizePlateKey(next.plate).slice(0, 15),
      from: next.from || null,
      to: next.to || null,
      driverId: keepLinks ? filters.driverId : null,
      vehicleId: keepLinks ? filters.vehicleId : null,
      exit: next.exit,
      page: 1,
    });
    startTransition(() => router.replace(href, { scroll: false }));
  }

  function change(patch: Partial<Fields>, delay = 0) {
    const next = { ...fields, ...patch };
    setFields(next);
    if (timer.current) clearTimeout(timer.current);
    if (delay > 0) timer.current = setTimeout(() => apply(next), delay);
    else apply(next);
  }

  function clear() {
    const empty: Fields = { plate: "", from: "", to: "", exit: "ALL" };
    setFields(empty);
    apply(empty, false);
  }

  return (
    <form
      method="get"
      action="/preoperacionales"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply(fields);
      }}
    >
      {filters.driverId && <input type="hidden" name="conductor" value={filters.driverId} />}
      {filters.vehicleId && <input type="hidden" name="vehiculo" value={filters.vehicleId} />}
      <div className="space-y-1.5">
        <Label htmlFor="insp-plate" className="text-sm text-foreground">
          Placa
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="insp-plate"
            name="placa"
            type="search"
            value={fields.plate}
            onChange={(e) => change({ plate: e.target.value }, PLATE_DELAY_MS)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABC123"
            className="h-11 w-40 pl-9 uppercase md:h-9"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="insp-from" className="text-sm text-foreground">
          Desde
        </Label>
        <Input
          id="insp-from"
          name="desde"
          type="date"
          value={fields.from}
          max={fields.to || undefined}
          onChange={(e) => change({ from: e.target.value })}
          className="h-11 md:h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="insp-to" className="text-sm text-foreground">
          Hasta
        </Label>
        <Input
          id="insp-to"
          name="hasta"
          type="date"
          value={fields.to}
          min={fields.from || undefined}
          onChange={(e) => change({ to: e.target.value })}
          className="h-11 md:h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="insp-exit" className="text-sm text-foreground">
          Salida
        </Label>
        <NativeSelect
          id="insp-exit"
          name="salida"
          value={exitFilterParam(fields.exit) ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            const option = EXIT_FILTER_OPTIONS.find((o) => (exitFilterParam(o.value) ?? "") === value);
            change({ exit: option?.value ?? "ALL" });
          }}
          className="h-11 w-40 md:h-9"
        >
          {EXIT_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={exitFilterParam(o.value) ?? ""}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {hasFilter && (
        <Button type="button" variant="ghost" className="h-11 px-4 md:h-9" onClick={clear}>
          Limpiar
        </Button>
      )}
      {pending && (
        <span role="status" className="flex h-11 items-center gap-1.5 text-sm text-muted-foreground md:h-9">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Filtrando…
        </span>
      )}
    </form>
  );
}
