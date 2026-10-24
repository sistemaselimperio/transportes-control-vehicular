"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { TabBar } from "@/components/app/tab-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  GROUP_LABELS,
  type AttentionItem,
  type OwnerGroup,
} from "@/modules/dashboard/domain/dashboard-metrics";
import {
  countByKind,
  filterAlerts,
  KIND_FILTERS,
  STATUS_FILTERS,
  type KindFilter,
  type StatusFilter,
} from "../domain/alert-filters";
import { ACTION_LABELS, KIND_LABELS, pillText, useAttentionAction } from "./attention-actions";
import { StatusPill } from "./status-pill";

const KIND_TAB_LABELS: Record<KindFilter, string> = { ALL: "Todas", ...KIND_LABELS };

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: "Todas",
  expired: "Vencidas",
  warning: "Por vencer",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Keeps the filters in the URL so a filtered list can be shared or reloaded. */
function syncUrl(kind: KindFilter, status: StatusFilter) {
  const url = new URL(window.location.href);
  if (kind === "ALL") url.searchParams.delete("tipo");
  else url.searchParams.set("tipo", kind);
  if (status === "ALL") url.searchParams.delete("estado");
  else url.searchParams.set("estado", status);
  window.history.replaceState(null, "", url);
}

/** "Alertas": every expired or expiring item of the fleet, filterable by kind, status and plate. */
export function AlertsView({
  items,
  group,
  initialKind,
  initialStatus,
}: {
  items: AttentionItem[];
  group: OwnerGroup | null;
  initialKind: KindFilter;
  initialStatus: StatusFilter;
}) {
  const [kind, setKind] = useState(initialKind);
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState("");
  const action = useAttentionAction();

  // Tab counts follow the status and plate filters, so they always match what a tab will show.
  const counts = countByKind(filterAlerts(items, { kind: "ALL", status, query }));
  const rows = filterAlerts(items, { kind, status, query });
  const expired = items.filter((i) => i.status === "expired").length;
  const hasFilters = kind !== "ALL" || status !== "ALL" || query !== "";

  function selectKind(next: KindFilter) {
    setKind(next);
    syncUrl(next, status);
  }

  function selectStatus(next: StatusFilter) {
    setStatus(next);
    syncUrl(kind, next);
  }

  function clearFilters() {
    setKind("ALL");
    setStatus("ALL");
    setQuery("");
    syncUrl("ALL", "ALL");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alertas"
        description={
          items.length === 0
            ? "Nada vencido ni por vencer en los próximos 30 días."
            : `${plural(expired, "vencida", "vencidas")} · ${plural(items.length - expired, "por vencer", "por vencer")} en 30 días${group ? ` · ${GROUP_LABELS[group]}` : ""}`
        }
      />

      <TabBar
        label="Tipo de alerta"
        items={KIND_FILTERS.map((k) => ({ key: k, label: KIND_TAB_LABELS[k], count: counts[k] }))}
        active={kind}
        onSelect={selectKind}
        idPrefix="alert-tab"
        panelId="alert-panel"
        chips
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Estado" className="inline-flex rounded-lg border bg-card p-0.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => selectStatus(s)}
              className={cn(
                "h-10 rounded-md px-3 text-sm text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 md:h-8",
                status === s && "bg-secondary font-semibold text-foreground",
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <label className="relative w-full sm:ml-auto sm:w-64">
          <span className="sr-only">Buscar por placa</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar placa"
            autoComplete="off"
            className="h-11 pl-8 md:h-9"
          />
        </label>
      </div>

      {action.banner}

      <section id="alert-panel" role="tabpanel" aria-labelledby={`alert-tab-${kind}`} className="panel">
        <div className="plate-head">
          <h2 className="micro-label text-foreground">{KIND_TAB_LABELS[kind]}</h2>
          {status !== "ALL" && <span className="micro-label">{STATUS_LABELS[status]}</span>}
          <span className="num ml-auto text-sm font-semibold">{rows.length}</span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 px-4 py-5 text-sm text-muted-foreground">
            {items.length === 0 ? "Sin alertas. La flota está al día." : "Ninguna alerta coincide con los filtros."}
            {hasFilters && items.length > 0 && (
              <Button type="button" variant="outline" className="h-9" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li
                key={`${row.plate}:${row.kind}`}
                data-active={action.isActive(row) ? "true" : undefined}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3 transition-colors duration-150 hover:bg-muted data-[active=true]:bg-secondary/70 md:grid-cols-[8rem_minmax(0,1fr)_auto_auto]"
              >
                <Link
                  href={`/flota/${encodeURIComponent(row.plate)}`}
                  aria-label={`Ver ficha de ${row.plate}`}
                  className="col-start-1 row-start-1 justify-self-start rounded-[5px] outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.97]"
                >
                  <span className="plate">{row.plate}</span>
                </Link>
                <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                  <span className="block text-sm font-medium">{KIND_LABELS[row.kind]}</span>
                  <span className="num block truncate text-xs text-muted-foreground">{row.detail}</span>
                </div>
                <StatusPill status={row.status} className="col-start-2 row-start-1 justify-self-end md:col-start-3">
                  {pillText(row)}
                </StatusPill>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`${ACTION_LABELS[row.kind]} ${KIND_LABELS[row.kind]} de ${row.plate}`}
                  className={cn(
                    "col-span-2 row-start-3 h-11 px-4 md:col-span-1 md:col-start-4 md:row-start-1 md:h-9",
                    row.status === "expired" && "border-danger-foreground/30",
                  )}
                  onClick={() => action.openFor(row)}
                >
                  {ACTION_LABELS[row.kind]}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {action.panel}
    </div>
  );
}
