"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ClientOption } from "@/modules/deliveries/ui/client-picker";
import type { CatalogProduct } from "../domain/catalog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import {
  DEFAULT_STATUS_FILTER,
  filterOrders,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  ordersTotals,
  type OrderFilters,
  type OrderRow,
  type OrderStatus,
} from "../domain/order-rules";
import { AnnulOrderDialog } from "./annul-order-dialog";
import { KgPerBagField } from "./kg-per-bag-field";
import { sortOrdersForList } from "../domain/order-days";
import { OrderLine } from "./order-line";
import { OrderForm } from "./order-form";

/** Orders page: the kg-per-bag setting, filters, one compact line per order, a general total and the sheets. */
export function OrdersView({
  rows,
  clients,
  references,
  kgPerBag,
  canManage,
  canSetKgPerBag,
  canCreateLoad,
  today,
}: {
  rows: readonly OrderRow[];
  clients: readonly ClientOption[];
  references: readonly CatalogProduct[];
  kgPerBag: number;
  canManage: boolean;
  canSetKgPerBag: boolean;
  /** The user manages loads: pending orders offer "Crear cargue". */
  canCreateLoad: boolean;
  /** Colombia's current day, read on the server. */
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | undefined>();
  const [annulling, setAnnulling] = useState<OrderRow | undefined>();
  const [filters, setFilters] = useState<OrderFilters>({ statuses: DEFAULT_STATUS_FILTER, from: null, to: null });
  const { message, flash } = useFlashMessage();

  const shown = useMemo(() => sortOrdersForList(filterOrders(rows, filters)), [rows, filters]);
  const totals = useMemo(() => ordersTotals(shown, kgPerBag), [shown, kgPerBag]);

  const openForm = (order?: OrderRow) => {
    setEditing(order);
    setOpen(true);
  };

  const toggleStatus = (status: OrderStatus) =>
    setFilters((f) => ({
      ...f,
      statuses: f.statuses.includes(status) ? f.statuses.filter((s) => s !== status) : [...f.statuses, status],
    }));

  return (
    <section className="space-y-5">
      <PageHeader
        title="Pedidos"
        description="Pedidos de concentrado por fecha de entrega, con sus bultos y su peso."
        actions={
          canManage && (
            <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
              <Plus aria-hidden />
              Nuevo pedido
            </Button>
          )
        }
      />

      <KgPerBagField kgPerBag={kgPerBag} canEdit={canSetKgPerBag} onDone={flash} />

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr] lg:max-w-3xl">
        <fieldset>
          <legend className="mb-1 block text-xs text-muted-foreground">Estado</legend>
          <div className="flex flex-wrap gap-1.5">
            {ORDER_STATUSES.map((status) => {
              const on = filters.statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "h-11 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9",
                    on ? "border-transparent bg-primary font-semibold text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {ORDER_STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="order-from-filter" className="mb-1 block text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="order-from-filter"
            type="date"
            className="h-11 md:h-9"
            value={filters.from ?? ""}
            max={filters.to ?? undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
          />
        </div>
        <div>
          <Label htmlFor="order-to-filter" className="mb-1 block text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="order-to-filter"
            type="date"
            className="h-11 md:h-9"
            value={filters.to ?? ""}
            min={filters.from ?? undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
          />
        </div>
      </div>

      <p className="num text-sm text-muted-foreground" aria-live="polite">
        {totals.count} de {rows.length} pedidos
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay pedidos para este filtro.</p>
      ) : (
        <section aria-label="Lista de pedidos" className="panel">
          <ul className="divide-y">
            {shown.map((order) => (
              <OrderLine
                key={order.id}
                order={order}
                today={today}
                kgPerBag={kgPerBag}
                canManage={canManage}
                canCreateLoad={canCreateLoad}
                onEdit={openForm}
                onAnnul={setAnnulling}
              />
            ))}
          </ul>
          <p className="num flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-3 text-sm font-semibold">
            <span>Total · {totals.count} {totals.count === 1 ? "pedido" : "pedidos"}</span>
            <span>
              {formatDecimal(totals.bags, 0)} bultos · {formatDecimal(totals.kg, 2)} kg · {formatDecimal(totals.tons, 3)} t
            </span>
          </p>
        </section>
      )}

      <FlashMessage message={message} />

      <AnnulOrderDialog order={annulling} onClose={() => setAnnulling(undefined)} onDone={flash} />

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        wide
        title={editing ? `Editar pedido #${editing.id}` : "Nuevo pedido"}
        description={editing && `Entrega ${formatDisplayDate(editing.deliveryDate)}`}
      >
        <OrderForm
          order={editing}
          clients={clients}
          references={references}
          kgPerBag={kgPerBag}
          onCancel={() => setOpen(false)}
          onDone={(msg) => {
            flash(msg);
            setOpen(false);
          }}
        />
      </SlideOver>
    </section>
  );
}
