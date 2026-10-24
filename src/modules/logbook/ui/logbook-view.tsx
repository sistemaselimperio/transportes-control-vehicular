"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import type { LogbookData, LogbookPage } from "../application/logbook-queries";
import {
  LOGBOOK_TABS,
  normalizePlateQuery,
  type FuelRow,
  type LogbookQuery,
  type LogbookTab,
  type OilRow,
  type ServiceRow,
  type TireRow,
} from "../domain/logbook";
import { FuelForm, ServiceForm, TireForm } from "./logbook-forms";
import { FuelList, OilList, ServiceList, TireList } from "./logbook-lists";
import { NoticeToast, useNotice } from "./notice";
import { OilCreateFlow, OilEditForm } from "./oil-forms";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const NEW_LABELS: Record<LogbookTab, { button: string; create: string; edit: string }> = {
  servicios: { button: "Servicio", create: "Registrar servicio", edit: "Editar servicio" },
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
    return `${plural(count, "tanqueo", "tanqueos")} · ${gallons.toLocaleString("es-CO", { maximumFractionDigits: 2 })} gal · ${formatPrice(amount)}`;
  }
  const { count, total, withoutPrice } = data.summary;
  return `${plural(count, "registro", "registros")} · ${formatPrice(total)}${withoutPrice > 0 ? ` · ${withoutPrice} sin precio` : ""}`;
}

/**
 * Bitácora page: one tab per logbook (servicios, aceite, llantas, combustible), each a fleet-wide
 * table. The tab, the plate and the month live in the URL and are filtered on the server, so the
 * list and its total always match what the link says.
 */
export function LogbookView({ page, tab, query }: { page: LogbookPage; tab: LogbookTab; query: LogbookQuery }) {
  const { data, providers, plates, today } = page;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState(query.plate);
  const [month, setMonth] = useState(query.month ?? "");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, notify] = useNotice();
  const plateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (plateTimer.current) clearTimeout(plateTimer.current);
    },
    [],
  );

  function go(next: { tab?: LogbookTab; plate?: string; month?: string }) {
    const params = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextPlate = normalizePlateQuery(next.plate ?? plate);
    const nextMonth = next.month ?? month;
    if (nextTab !== "servicios") params.set("tab", nextTab);
    if (nextPlate) params.set("placa", nextPlate);
    if (nextMonth) params.set("mes", nextMonth);
    if (query.group) params.set("grupo", query.group);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/bitacora?${qs}` : "/bitacora", { scroll: false }));
  }

  function changePlate(value: string) {
    setPlate(value);
    if (plateTimer.current) clearTimeout(plateTimer.current);
    plateTimer.current = setTimeout(() => go({ plate: value, month }), 350);
  }

  function clearFilters() {
    setPlate("");
    setMonth("");
    go({ plate: "", month: "" });
  }

  const filtered = Boolean(query.plate || query.month);
  const labels = NEW_LABELS[tab];
  const vehicle = { plates };
  const closeForm = () => {
    setCreating(false);
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
        description={`Servicios, cambios de aceite, llantas y combustible de la flota${query.group ? ` · ${GROUP_LABELS[query.group]}` : ""}.`}
        actions={
          <Button type="button" className="h-11 px-4 md:h-9" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {labels.button}
          </Button>
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full space-y-1.5 sm:w-48">
          <span className="text-sm">Placa</span>
          <Input
            type="search"
            value={plate}
            onChange={(e) => changePlate(e.target.value)}
            placeholder="ABC-123"
            autoComplete="off"
            className="h-11 md:h-9"
          />
        </label>
        <label className="block w-full space-y-1.5 sm:w-44">
          <span className="text-sm">Mes</span>
          <Input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              go({ month: e.target.value });
            }}
            className="h-11 md:h-9"
          />
        </label>
        {(plate || month) && (
          <Button type="button" variant="ghost" className="h-11 px-3 md:h-9" onClick={clearFilters}>
            <X aria-hidden />
            Limpiar
          </Button>
        )}
        <p className="num text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
          <span className="font-semibold text-foreground">{summaryText(data)}</span>
        </p>
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
        open={creating || editing !== null}
        onOpenChange={(open) => !open && closeForm()}
        title={editing ? NEW_LABELS[editing.tab].edit : labels.create}
        description={editing?.row.plate}
      >
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
