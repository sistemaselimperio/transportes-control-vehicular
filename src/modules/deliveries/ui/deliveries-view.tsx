"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { deleteDeliveryAction } from "../application/delivery-actions";
import { DELIVERY_TABS, DELIVERY_TAB_LABELS, type DeliveryTab } from "../domain/delivery-tabs";
import { pendingCount, selectPendingDeliveries, type ClientAlert, type DeliveryRow } from "../domain/delivery-rules";
import type { ClientOption } from "./client-picker";
import { DeliveryAlerts } from "./delivery-alerts";
import { DeliveryCreateForm, DeliveryEditForm } from "./delivery-form";
import { DeliveryHistory } from "./delivery-history";
import { DeliveryPending } from "./delivery-pending";
import { DeliverySummary } from "./delivery-summary";

/** Deliveries page: the four tabs, the edit sheet and the delete confirmation. */
export function DeliveriesView({
  rows,
  clients,
  plates,
  alerts,
  today,
  canManage,
  initialTab,
}: {
  rows: readonly DeliveryRow[];
  clients: readonly ClientOption[];
  plates: readonly string[];
  alerts: readonly ClientAlert[];
  /** Colombia's current day, read on the server. */
  today: string;
  canManage: boolean;
  initialTab: DeliveryTab;
}) {
  const [tab, setTab] = useState<DeliveryTab>(initialTab);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DeliveryRow | undefined>();
  const [deleting, setDeleting] = useState<DeliveryRow | undefined>();
  const { message, flash } = useFlashMessage();

  const pendingRows = useMemo(() => selectPendingDeliveries(rows, today), [rows, today]);
  const options = { clients, plates };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Entregas"
        description="Entregas de bultos a clientes por vehículo y viaje."
        actions={
          canManage && (
            <Button className="h-11 px-4 md:h-10" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Registrar entrega
            </Button>
          )
        }
      />

      <TabBar
        label="Secciones de entregas"
        items={DELIVERY_TABS.map((key) => ({
          key,
          label: DELIVERY_TAB_LABELS[key],
          count: key === "por-entregar" ? pendingCount(pendingRows) : key === "alertas" ? alerts.length : undefined,
        }))}
        active={tab}
        onSelect={setTab}
        idPrefix="delivery-tab"
        panelId="delivery-panel"
      />

      <div role="tabpanel" id="delivery-panel" aria-labelledby={`delivery-tab-${tab}`} className="space-y-4">
        {tab === "por-entregar" && (
          <DeliveryPending rows={pendingRows} today={today} canManage={canManage} onDone={flash} />
        )}

        {tab === "historial" && (
          <DeliveryHistory rows={rows} canManage={canManage} onEdit={setEditing} onDelete={setDeleting} />
        )}

        {tab === "alertas" && <DeliveryAlerts alerts={alerts} />}

        {tab === "resumen" && <DeliverySummary rows={rows} today={today} />}
      </div>

      <FlashMessage message={message} />

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar entrega"
        description={deleting && `${deleting.clientName} · ${formatDisplayDate(deleting.date)}`}
        warning={deleting ? `Se eliminará la entrega de ${deleting.clientName} del ${formatDisplayDate(deleting.date)}.` : ""}
        action={() =>
          deleting ? deleteDeliveryAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin entrega." })
        }
        onClose={() => setDeleting(undefined)}
        onDone={flash}
      />

      <SlideOver
        open={creating}
        onOpenChange={setCreating}
        title="Registrar entrega"
        description="Nueva entrega de bultos a un cliente."
      >
        {creating && (
          <DeliveryCreateForm options={options} today={today} onDone={flash} onClose={() => setCreating(false)} />
        )}
      </SlideOver>

      <SlideOver
        open={editing !== undefined}
        onOpenChange={(next) => !next && setEditing(undefined)}
        title="Editar entrega"
        description={editing && `${editing.clientName} · ${formatDisplayDate(editing.date)}`}
      >
        {editing && (
          <DeliveryEditForm
            delivery={editing}
            options={options}
            onCancel={() => setEditing(undefined)}
            onDone={(msg) => {
              flash(msg);
              setEditing(undefined);
            }}
          />
        )}
      </SlideOver>
    </section>
  );
}
