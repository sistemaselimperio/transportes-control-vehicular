"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PageHeader } from "@/components/app/page-header";
import { TabBar } from "@/components/app/tab-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  countByKind,
  filterAlerts,
  KIND_FILTERS,
  toggleStatus,
  type KindFilter,
  type StatusFilter,
} from "@/modules/alerts/domain/alert-filters";
import { SlideOver } from "@/components/app/slide-over";
import { KIND_LABELS, useDoneMessage } from "@/modules/alerts/ui/attention-actions";
import type { DashboardData } from "@/modules/dashboard/application/dashboard-queries";
import { GROUP_LABELS, type ItemKind } from "@/modules/dashboard/domain/dashboard-metrics";
import { groupVehicles } from "../domain/vehicle-queue";
import { TodayTimeline } from "./today-timeline";
import { VehicleDetail } from "./vehicle-panel";

const KIND_TAB_LABELS: Record<KindFilter, string> = { ALL: "Todas", ...KIND_LABELS };

const DESKTOP = "(min-width: 768px)";

/** True from the md breakpoint, where the vehicle panel is docked instead of a sheet. */
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function longDate(iso: string): string {
  // Noon UTC keeps the calendar day stable whatever the server timezone.
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Keeps the filters in the URL (next to `grupo`) so a filtered list can be shared or reloaded. */
function syncUrl(kind: KindFilter, status: StatusFilter, query: string) {
  const url = new URL(window.location.href);
  const set = (name: string, value: string, empty: boolean) => {
    if (empty) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  };
  set("tipo", kind, kind === "ALL");
  set("estado", status, status === "ALL");
  set("placa", query.trim(), query.trim() === "");
  window.history.replaceState(null, "", url);
}

/** A KPI that doubles as a status toggle. */
function Counter({
  label,
  value,
  hint,
  tone,
  pressed,
  onToggle,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "danger" | "warn";
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "block min-h-11 px-5 py-4 text-left outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset",
        pressed && "bg-secondary/70 shadow-[inset_0_-4px_0_var(--color-brand)]",
      )}
    >
      <span className="micro-label flex items-center justify-between gap-2">
        {label}
        {pressed && <span className="text-foreground">Filtrando</span>}
      </span>
      <span
        className={cn(
          "num mt-2 block text-4xl leading-none font-semibold",
          tone === "danger" && value > 0 && "text-danger-foreground",
          tone === "warn" && value > 0 && "text-warn-foreground",
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

/** "Hoy": vehicles that need attention, most urgent first, with the selected one open beside the list. */
export function TodayView({
  data,
  initialKind,
  initialStatus,
  initialQuery,
}: {
  data: DashboardData;
  initialKind: KindFilter;
  initialStatus: StatusFilter;
  initialQuery: string;
}) {
  const { kpis, group, attention } = data;
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { banner, flash } = useDoneMessage();
  const [kind, setKind] = useState(initialKind);
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const [picked, setPicked] = useState<{ plate: string; kind: ItemKind | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Tab counts follow the status and plate filters, so they always match what a tab will show.
  const counts = countByKind(filterAlerts(attention, { kind: "ALL", status, query }));
  const groups = groupVehicles(attention, { kind, status, query });
  const hasFilters = kind !== "ALL" || status !== "ALL" || query.trim() !== "";

  // The pick survives only while its vehicle is still listed; otherwise the most urgent one opens.
  const vehicles = groups.flatMap((g) => g.vehicles);
  const selected = vehicles.find((v) => v.plate === picked?.plate) ?? vehicles[0] ?? null;
  const selectedKind =
    selected?.items.find((i) => selected.plate === picked?.plate && i.kind === picked?.kind)?.kind ??
    selected?.items[0]?.kind ??
    null;

  const finding =
    kpis.expiredItems === 0
      ? kpis.warningItems === 0
        ? "Nada vencido ni por vencer en los próximos 30 días."
        : `Nada vencido hoy. ${plural(kpis.warningItems, "pendiente por vencer", "pendientes por vencer")}.`
      : `${plural(kpis.expiredItems, "vencido", "vencidos")} en ${plural(kpis.expiredVehicles, "vehículo", "vehículos")}.`;

  function selectKind(next: KindFilter) {
    setKind(next);
    syncUrl(next, status, query);
  }

  function toggle(target: StatusFilter) {
    const next = toggleStatus(status, target);
    setStatus(next);
    syncUrl(kind, next, query);
  }

  function changeQuery(next: string) {
    setQuery(next);
    syncUrl(kind, status, next);
  }

  function clearFilters() {
    setKind("ALL");
    setStatus("ALL");
    setQuery("");
    syncUrl("ALL", "ALL", "");
  }

  function pick(plate: string, itemKind: ItemKind | null) {
    setPicked({ plate, kind: itemKind });
    if (!isDesktop) setSheetOpen(true);
  }

  function done(message: string) {
    setSheetOpen(false);
    flash(message);
    router.refresh();
  }

  const detail = selected && selectedKind && (
    <VehicleDetail
      key={selected.plate}
      vehicle={selected}
      kind={selectedKind}
      onSelectKind={(k) => setPicked({ plate: selected.plate, kind: k })}
      onDone={done}
      onCancel={() => setSheetOpen(false)}
      showPlate={isDesktop}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hoy"
        description={
          <>
            <span className="first-letter:uppercase">{longDate(data.today)}</span>
            {group ? ` · ${GROUP_LABELS[group]}` : ""}
          </>
        }
      />

      <div role="group" aria-label="Filtrar por estado" className="panel grid grid-cols-2 divide-x">
        <Counter
          label="Vencidos"
          value={kpis.expiredVehicles}
          hint={`${plural(kpis.expiredItems, "documento", "documentos")}`}
          tone="danger"
          pressed={status === "expired"}
          onToggle={() => toggle("expired")}
        />
        <Counter
          label="Por vencer"
          value={kpis.warningVehicles}
          hint={`${plural(kpis.warningItems, "documento", "documentos")} · 30 días`}
          tone="warn"
          pressed={status === "warning"}
          onToggle={() => toggle("warning")}
        />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">{finding}</p>

      {banner}

      {attention.length === 0 ? (
        <div className="panel px-5 py-6 text-sm text-muted-foreground">Sin alertas. La flota está al día.</div>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:gap-4">
            <div className="min-w-0 flex-1">
              <TabBar
                label="Tipo de alerta"
                items={KIND_FILTERS.map((k) => ({ key: k, label: KIND_TAB_LABELS[k], count: counts[k] }))}
                active={kind}
                onSelect={selectKind}
                idPrefix="today-tab"
                panelId="today-panel"
              />
            </div>
            <label className="relative w-full md:w-64">
              <span className="sr-only">Buscar por placa</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                placeholder="Buscar placa"
                autoComplete="off"
                className="h-11 pl-8 focus-visible:ring-2 focus-visible:ring-ring/70"
              />
            </label>
          </div>

          <div id="today-panel" role="tabpanel" aria-labelledby={`today-tab-${kind}`}>
            {groups.length === 0 ? (
              <div className="panel flex flex-wrap items-center gap-3 px-5 py-5 text-sm text-muted-foreground">
                No hay alertas con estos filtros
                {hasFilters && (
                  <Button type="button" variant="outline" className="h-11" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_24rem]">
                <TodayTimeline groups={groups} selectedPlate={selected?.plate ?? null} onSelect={pick} />
                {isDesktop && (
                  <aside
                    aria-label="Vehículo seleccionado"
                    className="panel flex flex-col md:sticky md:top-8 md:max-h-[calc(100dvh-4rem)]"
                  >
                    {detail}
                  </aside>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {!isDesktop && (
        <SlideOver
          open={sheetOpen && !!selected}
          onOpenChange={setSheetOpen}
          title={selected ? `Vehículo ${selected.plate}` : ""}
          bodyClassName="flex flex-col p-0"
        >
          {detail}
        </SlideOver>
      )}
    </div>
  );
}
