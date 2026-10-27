"use client";

import { CheckCircle2, Search } from "lucide-react";
import { useState } from "react";
import { DeleteAllButton } from "@/components/app/delete-all-button";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Input } from "@/components/ui/input";
import { GROUP_LABELS, type OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";
import { deleteAllSalesAction } from "../application/sale-actions";
import {
  ALL_YEARS,
  countByYear,
  filterSales,
  formatPrice,
  NO_DATE,
  resolveYear,
  saleYears,
  summarizeSales,
  type SaleRow,
  type YearFilter,
} from "../domain/sale-row";
import { SaleForm } from "./sale-form";
import { SaleList } from "./sale-list";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Keeps the year in the URL so a filtered list can be shared or reloaded. */
function syncUrl(year: YearFilter) {
  const url = new URL(window.location.href);
  if (year === ALL_YEARS) url.searchParams.delete("anio");
  else url.searchParams.set("anio", year);
  window.history.replaceState(null, "", url);
}

/** Sales page: year chips, search, a summary of what is shown, the list and the edit side sheet. */
export function SalesView({
  rows,
  group,
  initialYear,
}: {
  rows: readonly SaleRow[];
  group: OwnerGroup | null;
  initialYear: YearFilter;
}) {
  const [year, setYear] = useState(() => resolveYear(initialYear, rows));
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SaleRow | undefined>();
  const [message, setMessage] = useState<string | null>(null);

  // Tab counts follow the search, so they always match what a tab will show.
  const counts = countByYear(filterSales(rows, { year: ALL_YEARS, query }));
  const tabs = [
    { key: ALL_YEARS, label: "Todos" },
    ...saleYears(rows).map((y) => ({ key: y, label: y })),
    ...(rows.some((r) => r.date === null) ? [{ key: NO_DATE, label: "Sin fecha" }] : []),
  ];
  const activeYear = resolveYear(year, rows);
  const visible = filterSales(rows, { year: activeYear, query });
  const summary = summarizeSales(visible);

  function selectYear(next: YearFilter) {
    setYear(next);
    syncUrl(next);
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Ventas"
        description={`Vehículos vendidos y a quién${group ? ` · ${GROUP_LABELS[group]}` : ""}.`}
        actions={
          <DeleteAllButton count={rows.length} title="Eliminar todas las ventas" action={deleteAllSalesAction}>
            <p className="font-medium">Se eliminarán TODOS los registros de ventas, no solo los que ves en pantalla.</p>
            <p className="text-muted-foreground">Los vehículos no se eliminan y conservan su estado de vendido.</p>
          </DeleteAllButton>
        }
      />

      <TabBar
        label="Año de la venta"
        items={tabs.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))}
        active={activeYear}
        onSelect={selectYear}
        idPrefix="sale-tab"
        panelId="sale-panel"
        chips
      />

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="num font-semibold text-foreground">{plural(summary.count, "venta", "ventas")}</span>
          {" · "}
          <span className="num font-semibold text-foreground">{formatPrice(summary.total)}</span>
          {summary.withoutPrice > 0 && ` · ${plural(summary.withoutPrice, "sin precio", "sin precio")}`}
        </p>

        <label className="relative w-full sm:ml-auto sm:w-64">
          <span className="sr-only">Buscar por placa o comprador</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar placa o comprador"
            autoComplete="off"
            className="h-11 pl-8 md:h-9"
          />
        </label>
      </div>

      <div id="sale-panel" role="tabpanel" aria-labelledby={`sale-tab-${activeYear}`}>
        <SaleList
          rows={visible}
          empty={rows.length === 0 ? "Aún no hay ventas registradas." : "Ninguna venta coincide con los filtros."}
          onEdit={setEditing}
        />
      </div>

      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground shadow-soft"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      <SlideOver
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        title="Editar venta"
        description={editing?.plate}
      >
        {editing && (
          <SaleForm
            key={editing.id}
            sale={editing}
            onCancel={() => setEditing(undefined)}
            onDone={(msg) => {
              setMessage(msg);
              setTimeout(() => setMessage(null), 6000);
              setEditing(undefined);
            }}
          />
        )}
      </SlideOver>
    </section>
  );
}
