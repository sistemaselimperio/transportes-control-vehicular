"use client";

import { CalendarRange, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import type { LogbookData, LogbookPage } from "../application/logbook-queries";
import {
  LOGBOOK_TABS,
  monthBounds,
  normalizePlateQuery,
  type FuelRow,
  type LogbookQuery,
  type LogbookTab,
  type OilRow,
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

function summaryText(data: LogbookData): string {
  if (data.tab === "combustible") {
    const { count, gallons, amount } = data.summary;
    return `${plural(count, "tanqueo", "tanqueos")} · ${gallons.toLocaleString("es-CO", { maximumFractionDigits: 2 })} de cantidad · ${formatPrice(amount)}`;
  }
  if (data.tab === "aceite") return plural(data.summary.count, "cambio", "cambios");
  const { count, total, withoutPrice } = data.summary;
  return `${plural(count, "registro", "registros")} · ${formatPrice(total)}${withoutPrice > 0 ? ` · ${withoutPrice} sin precio` : ""}`;
}

/**
 * Bitácora page: one tab per logbook (servicios, aceite, llantas, combustible), each a fleet-wide
 * table. The tab, the plate and the date range live in the URL and are filtered on the server, so the
 * list and its total always match what the link says.
 */
export function LogbookView({ page, tab, query }: { page: LogbookPage; tab: LogbookTab; query: LogbookQuery }) {
  const { data, providers, plates, today } = page;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState(query.plate);
  const [from, setFrom] = useState(query.from ?? "");
  const [to, setTo] = useState(query.to ?? "");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, notify] = useNotice();

  function go(next: { tab?: LogbookTab; plate?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextPlate = normalizePlateQuery(next.plate ?? plate);
    const nextFrom = next.from ?? from;
    const nextTo = next.to ?? to;
    if (nextTab !== "servicios") params.set("tab", nextTab);
    if (nextPlate) params.set("placa", nextPlate);
    if (nextFrom) params.set("desde", nextFrom);
    if (nextTo) params.set("hasta", nextTo);
    if (query.group) params.set("grupo", query.group);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/bitacora?${qs}` : "/bitacora", { scroll: false }));
  }

  function changePlate(value: string) {
    setPlate(value);
    go({ plate: value });
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
    go({ plate: "", from: "", to: "" });
  }

  const filtered = Boolean(query.plate || query.from || query.to);
  const labels = NEW_LABELS[tab];
  const vehicle = { plates };
  // The Excel import is per vehicle: it needs one plate chosen (sold vehicles are not in `plates`).
  const importPlate = query.plate ? (plates.find((p) => normalizePlateQuery(p) === query.plate) ?? null) : null;
  // Clearing a list is per vehicle too, and only offered when there is something listed to clear.
  const bulkCount = data.rows.length;
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
  const list = { empty, onResult };

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
            {importPlate && bulkCount > 0 && (
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

      <div className="rounded-xl border bg-card">
        <div role="search" aria-label="Filtros de la bitácora" className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5 sm:w-48">
            <label htmlFor="logbook-plate" className="block text-sm font-medium">
              Placa
            </label>
            <NativeSelect
              id="logbook-plate"
              value={plates.find((p) => normalizePlateQuery(p) === normalizePlateQuery(plate)) ?? ""}
              onChange={(e) => changePlate(e.target.value)}
              className="h-11 md:h-9"
            >
              <option value="">Todas las placas</option>
              {plates.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-48">
            <label htmlFor="logbook-period" className="block text-sm font-medium">
              Período
            </label>
            <NativeSelect
              id="logbook-period"
              value={period}
              onChange={(e) => changePeriod(e.target.value)}
              className="h-11 md:h-9"
            >
              <option value="all">Todo el historial</option>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Personalizado…</option>
            </NativeSelect>
          </div>
          {period === "custom" && (
            // A div, not a fieldset: some browsers ignore `gap` on fieldset grid/flex layouts.
            <div role="group" aria-label="Rango de fechas" className="grid grid-cols-2 gap-4 sm:flex sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="logbook-from" className="block text-sm font-medium">
                  Desde
                </label>
                <Input
                  id="logbook-from"
                  type="date"
                  value={from}
                  max={to || today}
                  onChange={(e) => changeRange(e.target.value, to)}
                  className="h-11 sm:w-40 md:h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="logbook-to" className="block text-sm font-medium">
                  Hasta
                </label>
                <Input
                  id="logbook-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={today}
                  onChange={(e) => changeRange(from, e.target.value)}
                  className="h-11 sm:w-40 md:h-9"
                />
              </div>
            </div>
          )}
          {(plate || period !== "all") && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 self-start px-3 text-muted-foreground sm:self-auto md:h-9"
              onClick={clearFilters}
            >
              <X aria-hidden />
              Limpiar
            </Button>
          )}
        </div>
        <div
          className="flex flex-col gap-1 border-t bg-muted/40 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
          aria-live="polite"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarRange aria-hidden className="size-4" />
            <span className="num">{rangeText}</span>
          </span>
          <span className="num font-semibold text-foreground">{summaryText(data)}</span>
        </div>
      </div>

      <div
        id="logbook-panel"
        role="tabpanel"
        aria-labelledby={`logbook-tab-${tab}`}
        aria-busy={pending}
        className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        {data.tab === "servicios" && (
          <ServiceList rows={data.rows} {...list} onEdit={(row) => setEditing({ tab: "servicios", row })} />
        )}
        {data.tab === "aceite" && (
          <OilList rows={data.rows} {...list} onEdit={(row) => setEditing({ tab: "aceite", row })} />
        )}
        {data.tab === "llantas" && (
          <TireList rows={data.rows} {...list} onEdit={(row) => setEditing({ tab: "llantas", row })} />
        )}
        {data.tab === "combustible" && (
          <FuelList rows={data.rows} {...list} onEdit={(row) => setEditing({ tab: "combustible", row })} />
        )}
      </div>

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
