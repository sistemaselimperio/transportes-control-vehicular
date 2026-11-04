"use client";

import { CalendarRange, ChevronLeft, ChevronRight, Plus, Search, Trash2, Truck, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import type { LogbookPage, TabSummary } from "../application/logbook-queries";
import {
  LOGBOOK_SEARCH_MAX,
  LOGBOOK_TABS,
  monthBounds,
  normalizePlateQuery,
  SERVICE_KIND_LABELS,
  type FuelRow,
  type LogbookQuery,
  type LogbookTab,
  type OilRow,
  type ServiceKind,
  type ServiceRow,
  type TireRow,
} from "../domain/logbook";
import { LogbookBulkDelete } from "./logbook-bulk-delete";
import { FuelForm, ServiceForm, TireForm } from "./logbook-forms";
import { LogbookImportFlow } from "./logbook-import";
import { FuelList, OilList, ServiceList, TireList } from "./logbook-lists";
import { NoticeToast, useNotice } from "./notice";
import { OilCreateFlow, OilEditForm } from "./oil-forms";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Quick ranges next to the date pickers; each is computed from today's date. */
function rangePresets(today: string): { key: string; label: string; from: string; to: string }[] {
  const [year, month] = today.split("-").map(Number);
  const monthKey = (offset: number) => {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const thisMonth = monthBounds(monthKey(0));
  return [
    { key: "this-month", label: "Este mes", from: thisMonth.from, to: today },
    { key: "last-month", label: "Mes pasado", ...monthBounds(monthKey(-1)) },
    { key: "last-3-months", label: "Últimos 3 meses", from: monthBounds(monthKey(-2)).from, to: today },
    { key: "this-year", label: "Este año", from: `${year}-01-01`, to: today },
  ];
}

/** Every filter control shares one height: 44px touch targets on phones, 36px from `md`. */
const CONTROL = "h-11 md:h-9";

/** The period track: everything, the quick ranges, then a custom range. Short labels keep it on one row. */
const PERIOD_OPTIONS = (presets: ReturnType<typeof rangePresets>) => [
  { key: "all", label: "Todo" },
  ...presets.map((p) => ({ key: p.key, label: p.key === "last-3-months" ? "3 meses" : p.label })),
  { key: "custom", label: "Rango" },
];

const NEW_LABELS: Record<LogbookTab, { button: string; create: string; edit: string }> = {
  servicios: { button: "Mantenimiento", create: "Registrar mantenimiento", edit: "Editar mantenimiento" },
  aceite: { button: "Cambio de aceite", create: "Registrar cambio de aceite", edit: "Editar cambio de aceite" },
  llantas: { button: "Llantas", create: "Registrar cambio de llantas", edit: "Editar cambio de llantas" },
  combustible: { button: "Tanqueo", create: "Registrar tanqueo", edit: "Editar tanqueo" },
};

/** The row being edited, tagged by its list. */
type Editing =
  | { tab: "servicios"; row: ServiceRow }
  | { tab: "aceite"; row: OilRow }
  | { tab: "llantas"; row: TireRow }
  | { tab: "combustible"; row: FuelRow };

function summaryText(data: TabSummary): string {
  if (data.tab === "combustible") {
    const { count, gallons, urea, amount } = data.summary;
    const text = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
    return `${plural(count, "tanqueo", "tanqueos")} · ${text(gallons)} de cantidad · ${text(urea)} de urea · ${formatPrice(amount)}`;
  }
  if (data.tab === "aceite") return plural(data.summary.count, "cambio", "cambios");
  const { count, total, withoutPrice } = data.summary;
  return `${plural(count, "registro", "registros")} · ${formatPrice(total)}${withoutPrice > 0 ? ` · ${withoutPrice} sin precio` : ""}`;
}

/**
 * Bitácora page: one tab per logbook (servicios, aceite, llantas, combustible). The fleet-wide totals
 * are always shown; the records are listed per vehicle, 50 at a time. The tab, plate, date range,
 * search, filters and page live in the URL and are applied on the server, so the list and its totals
 * always match what the link says.
 */
export function LogbookView({ page, tab, query }: { page: LogbookPage; tab: LogbookTab; query: LogbookQuery }) {
  const { fleet, vehicle: listing, providers, plates, today } = page;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState(query.plate);
  const [from, setFrom] = useState(query.from ?? "");
  const [to, setTo] = useState(query.to ?? "");
  const [search, setSearch] = useState(query.search);
  const [kind, setKind] = useState<ServiceKind | "">(query.kind ?? "");
  const [driverId, setDriverId] = useState(query.driverId === null ? "" : String(query.driverId));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, notify] = useNotice();

  /** Any change resets the page: only an explicit `page` keeps it. */
  function hrefFor(next: {
    tab?: LogbookTab;
    plate?: string;
    from?: string;
    to?: string;
    q?: string;
    kind?: ServiceKind | "";
    driverId?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextPlate = normalizePlateQuery(next.plate ?? plate);
    const nextFrom = next.from ?? from;
    const nextTo = next.to ?? to;
    const nextSearch = (next.q ?? search).trim();
    // The kind exists on the servicios tab only; search and filters are per vehicle.
    const nextKind = nextTab === "servicios" ? (next.kind ?? kind) : "";
    const nextDriver = next.driverId ?? driverId;
    if (nextTab !== "servicios") params.set("tab", nextTab);
    if (nextPlate) params.set("placa", nextPlate);
    if (nextFrom) params.set("desde", nextFrom);
    if (nextTo) params.set("hasta", nextTo);
    if (query.group) params.set("grupo", query.group);
    if (nextPlate && nextSearch) params.set("q", nextSearch);
    if (nextPlate && nextKind) params.set("tipo", nextKind);
    if (nextPlate && nextDriver) params.set("conductor", nextDriver);
    if (next.page && next.page > 1) params.set("pagina", String(next.page));
    const qs = params.toString();
    return qs ? `/bitacora?${qs}` : "/bitacora";
  }

  function go(next: Parameters<typeof hrefFor>[0]) {
    clearTimeout(searchTimer.current);
    startTransition(() => router.replace(hrefFor(next), { scroll: false }));
  }

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function changePlate(value: string) {
    setPlate(value);
    // The driver list belongs to the vehicle, so the old choice no longer applies.
    setDriverId("");
    go({ plate: value, driverId: "" });
  }

  /** Waits for a pause in typing before asking the server. */
  function changeSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => go({ q: value }), 300);
  }

  function changeKind(value: ServiceKind | "") {
    setKind(value);
    go({ kind: value });
  }

  function changeDriver(value: string) {
    setDriverId(value);
    go({ driverId: value });
  }

  const presets = rangePresets(today);
  const [customRange, setCustomRange] = useState(false);
  const matched = presets.find((p) => p.from === from && p.to === to);
  // "all" and the presets are derived from the dates; "custom" also covers a half-filled range.
  const period = matched ? matched.key : customRange || from || to ? "custom" : "all";

  function changePeriod(value: string) {
    if (value === "custom") {
      setCustomRange(true);
      return;
    }
    setCustomRange(false);
    const preset = presets.find((p) => p.key === value);
    changeRange(preset?.from ?? "", preset?.to ?? "");
  }

  const rangeText =
    from || to
      ? `${from ? formatDisplayDate(from) : "Inicio"} – ${to ? formatDisplayDate(to) : "Hoy"}`
      : "Todo el historial";

  function changeRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    go({ from: nextFrom, to: nextTo });
  }

  function clearFilters() {
    setPlate("");
    setFrom("");
    setTo("");
    setCustomRange(false);
    setSearch("");
    setKind("");
    setDriverId("");
    go({ plate: "", from: "", to: "", q: "", kind: "", driverId: "" });
  }

  const narrowed = Boolean(query.search || query.kind || query.driverId !== null);
  const filtered = Boolean(query.plate || query.from || query.to || narrowed);
  const labels = NEW_LABELS[tab];
  const vehicle = { plates };
  // The Excel import is per vehicle: it needs one plate chosen (sold vehicles are not in `plates`).
  const importPlate = query.plate ? (plates.find((p) => normalizePlateQuery(p) === query.plate) ?? null) : null;
  // Clearing a list is per vehicle too, over its plate and period: offered only when no search, kind or
  // driver filter narrows the list, so the count shown is exactly what would be deleted.
  const bulkCount = listing?.data.summary.count ?? 0;
  const bulkScope = `${plural(bulkCount, "registro", "registros")} de ${LOGBOOK_TABS.find((t) => t.key === tab)?.label ?? ""} de ${importPlate ?? ""} · ${rangeText}`;
  const closeForm = () => {
    setCreating(false);
    setImporting(false);
    setDeletingAll(false);
    setEditing(null);
  };
  const done = (message: string) => {
    notify({ tone: "ok", text: message });
    closeForm();
  };
  const onResult = (result: ActionResult) =>
    notify(result.ok ? { tone: "ok", text: result.message } : { tone: "error", text: result.error });
  const empty =
    filtered || query.group ? "Ningún registro coincide con los filtros." : "Aún no hay registros en esta bitácora.";
  const list = { empty, onResult, total: bulkCount };

  const formProps = { today, providers, vehicle, onDone: done, onCancel: closeForm };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Bitácora"
        description={`Mantenimientos, cambios de aceite, llantas y combustible de la flota${query.group ? ` · ${GROUP_LABELS[query.group]}` : ""}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {importPlate && (
              <Button type="button" variant="outline" className="h-11 px-4 md:h-9" onClick={() => setImporting(true)}>
                <Upload aria-hidden />
                Importar Excel
              </Button>
            )}
            {importPlate && !narrowed && bulkCount > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive md:h-9"
                onClick={() => setDeletingAll(true)}
              >
                <Trash2 aria-hidden />
                Eliminar registros
              </Button>
            )}
            <Button type="button" className="h-11 px-4 md:h-9" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {labels.button}
            </Button>
          </div>
        }
      />

      <TabBar
        label="Tipo de registro"
        items={LOGBOOK_TABS}
        active={tab}
        onSelect={(next) => go({ tab: next })}
        idPrefix="logbook-tab"
        panelId="logbook-panel"
      />

      <div role="search" aria-label="Filtros de la bitácora" className="space-y-2.5">
        {/* Scope first: which vehicle and which period. */}
        <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
          <div className="relative md:w-52">
            <Truck aria-hidden className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <NativeSelect
              id="logbook-plate"
              aria-label="Placa"
              value={plates.find((p) => normalizePlateQuery(p) === normalizePlateQuery(plate)) ?? ""}
              onChange={(e) => changePlate(e.target.value)}
              className={cn(CONTROL, "num w-full pl-9", plate && "font-semibold")}
            >
              <option value="">Todas las placas</option>
              {plates.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div
            role="radiogroup"
            aria-label="Período"
            className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] md:w-fit [&::-webkit-scrollbar]:hidden"
          >
            {PERIOD_OPTIONS(presets).map((o) => {
              const selected = period === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => changePeriod(o.key)}
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.98] md:h-7",
                    selected && "bg-card text-foreground shadow-sm",
                  )}
                >
                  {o.key === "custom" && <CalendarRange aria-hidden className="size-3.5" />}
                  {o.label}
                </button>
              );
            })}
          </div>

          {(plate || period !== "all" || search || kind || driverId) && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 self-start px-3 text-muted-foreground md:ml-auto md:h-9 md:self-auto"
              onClick={clearFilters}
            >
              <X aria-hidden />
              Limpiar filtros
            </Button>
          )}
        </div>

        {period === "custom" && (
          // A div, not a fieldset: some browsers ignore `gap` on fieldset grid/flex layouts.
          <div
            role="group"
            aria-label="Rango de fechas"
            className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none"
          >
            <label htmlFor="logbook-from">Desde</label>
            <Input
              id="logbook-from"
              type="date"
              value={from}
              max={to || today}
              onChange={(e) => changeRange(e.target.value, to)}
              className={cn(CONTROL, "num w-40 text-foreground")}
            />
            <label htmlFor="logbook-to">hasta</label>
            <Input
              id="logbook-to"
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              onChange={(e) => changeRange(from, e.target.value)}
              className={cn(CONTROL, "num w-40 text-foreground")}
            />
          </div>
        )}

        {/* Narrowing inside one vehicle's records. */}
        {listing && (
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <div className="relative md:flex-1 md:max-w-md">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="logbook-search"
                type="search"
                aria-label="Buscar"
                value={search}
                maxLength={LOGBOOK_SEARCH_MAX}
                placeholder="Buscar descripción, proveedor, notas…"
                onChange={(e) => changeSearch(e.target.value)}
                className={cn(CONTROL, "pl-9")}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:flex">
              {tab === "servicios" && (
                <NativeSelect
                  id="logbook-kind"
                  aria-label="Tipo de mantenimiento"
                  value={kind}
                  onChange={(e) => changeKind(e.target.value as ServiceKind | "")}
                  className={cn(CONTROL, "md:w-44", kind && "font-semibold")}
                >
                  <option value="">Tipo: todos</option>
                  {Object.entries(SERVICE_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              )}
              <NativeSelect
                id="logbook-driver"
                aria-label="Conductor"
                value={listing.drivers.some((d) => String(d.id) === driverId) ? driverId : ""}
                onChange={(e) => changeDriver(e.target.value)}
                className={cn(CONTROL, "md:w-52", driverId && "font-semibold")}
              >
                <option value="">Conductor: todos</option>
                {listing.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        )}
      </div>

      {/* Totals as figures: what the filters add up to. */}
      <dl aria-live="polite" className="flex flex-col gap-x-10 gap-y-3 rounded-lg bg-muted/50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-baseline">
        <div>
          <dt className="text-xs text-muted-foreground">Período</dt>
          <dd className="num text-sm font-medium">{rangeText}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Flota</dt>
          <dd className="num text-sm font-semibold">{summaryText(fleet)}</dd>
        </div>
        {listing && (
          <div>
            <dt className="text-xs text-muted-foreground">
              {listing.plate}
              {narrowed ? " · filtrado" : ""}
            </dt>
            <dd className="num text-sm font-semibold">{summaryText(listing.data)}</dd>
          </div>
        )}
      </dl>

      <div
        id="logbook-panel"
        role="tabpanel"
        aria-labelledby={`logbook-tab-${tab}`}
        aria-busy={pending}
        className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        {!listing && <p className="text-sm text-muted-foreground">Selecciona un vehículo para ver sus registros.</p>}
        {listing?.data.tab === "servicios" && (
          <ServiceList rows={listing.data.rows} {...list} onEdit={(row) => setEditing({ tab: "servicios", row })} />
        )}
        {listing?.data.tab === "aceite" && (
          <OilList rows={listing.data.rows} {...list} onEdit={(row) => setEditing({ tab: "aceite", row })} />
        )}
        {listing?.data.tab === "llantas" && (
          <TireList rows={listing.data.rows} {...list} onEdit={(row) => setEditing({ tab: "llantas", row })} />
        )}
        {listing?.data.tab === "combustible" && (
          <FuelList rows={listing.data.rows} {...list} onEdit={(row) => setEditing({ tab: "combustible", row })} />
        )}
      </div>

      {listing && (listing.page > 1 || listing.hasNext) && (
        <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
          {listing.page > 1 ? (
            <Link
              href={hrefFor({ page: listing.page - 1 })}
              className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-9" })}
            >
              <ChevronLeft aria-hidden />
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="num text-sm text-muted-foreground">Página {listing.page}</span>
          {listing.hasNext ? (
            <Link
              href={hrefFor({ page: listing.page + 1 })}
              className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-9" })}
            >
              Siguiente
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <NoticeToast notice={notice} />

      <SlideOver
        open={creating || importing || deletingAll || editing !== null}
        onOpenChange={(open) => !open && closeForm()}
        title={
          importing
            ? "Importar bitácora desde Excel"
            : deletingAll
              ? "Eliminar registros"
              : editing
                ? NEW_LABELS[editing.tab].edit
                : labels.create
        }
        description={importing || deletingAll ? (importPlate ?? undefined) : editing?.row.plate}
      >
        {importing && importPlate && <LogbookImportFlow plate={importPlate} onDone={done} onCancel={closeForm} />}
        {deletingAll && importPlate && (
          <LogbookBulkDelete
            tab={tab}
            plate={importPlate}
            from={query.from ?? ""}
            to={query.to ?? ""}
            count={bulkCount}
            scopeText={bulkScope}
            onDone={done}
            onCancel={closeForm}
          />
        )}
        {creating && tab === "servicios" && <ServiceForm {...formProps} />}
        {creating && tab === "aceite" && <OilCreateFlow plates={plates} onDone={done} onCancel={closeForm} />}
        {creating && tab === "llantas" && <TireForm {...formProps} />}
        {creating && tab === "combustible" && <FuelForm {...formProps} />}
        {editing?.tab === "servicios" && <ServiceForm key={editing.row.id} row={editing.row} {...formProps} />}
        {editing?.tab === "aceite" && (
          <OilEditForm key={editing.row.id} row={editing.row} today={today} onDone={done} onCancel={closeForm} />
        )}
        {editing?.tab === "llantas" && <TireForm key={editing.row.id} row={editing.row} {...formProps} />}
        {editing?.tab === "combustible" && <FuelForm key={editing.row.id} row={editing.row} {...formProps} />}
      </SlideOver>
    </section>
  );
}
