"use client";

import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { deleteBalanceTripAction, deleteLoadAction } from "../application/load-actions";
import {
  buildPendingBalances,
  pendingEntries,
  type BalanceTripRow,
  type LoadBalanceRow,
  type PendingBalanceRow,
} from "../domain/load-balance";
import { buildPendingOrders } from "../domain/load-pending";
import { isFreeLoad } from "../domain/load-lines";
import { buildLoadSummary } from "../domain/load-summary";
import {
  filterLoads,
  formatCop,
  isLoadSupplier,
  LOAD_SUPPLIERS,
  totalsOfLoads,
  type LoadFilters,
  type LoadRow,
} from "../domain/load-rules";
import { BalanceTripForm } from "./balance-trip-form";
import { FreeLoadForm } from "./free-load-form";
import { LoadForm } from "./load-form";
import { LoadList } from "./load-list";
import { LoadSummary } from "./load-summary";
import { PendingLoads } from "./pending-loads";

type LoadsTab = "pendientes" | "historial" | "resumen";

/** Loads page: a tab with the orders still to load, one with the loads made (filters, totals, list) and a notebook-like summary sharing those filters, plus the create / edit side sheet and the delete confirmation. */
export function LoadsView({
  rows,
  balances,
  plates,
  orders,
  kgPerBag,
  presetOrderId,
  canManage,
  today,
}: {
  rows: readonly LoadRow[];
  /** The bags the loads left behind, with their trips. */
  balances: readonly LoadBalanceRow[];
  plates: readonly string[];
  /** Every order that is not annulled: the pending list and the form take the parts still to load. */
  orders: readonly OrderRow[];
  kgPerBag: number;
  /** The order whose load form opens at once, from the "Crear cargue" button of the orders page. */
  presetOrderId: number | null;
  canManage: boolean;
  /** Colombia's current day, read on the server. */
  today: string;
}) {
  const [tab, setTab] = useState<LoadsTab>("pendientes");
  const [open, setOpen] = useState(presetOrderId !== null);
  // The order whose loads are being created; an edit takes the orders of its load.
  const [creatingOrderId, setCreatingOrderId] = useState<number | null>(presetOrderId);
  const [editing, setEditing] = useState<LoadRow | undefined>();
  // The free load (made without an order) side sheet: new, or editing `editingFree`.
  const [freeOpen, setFreeOpen] = useState(false);
  const [editingFree, setEditingFree] = useState<LoadRow | undefined>();
  const [deleting, setDeleting] = useState<LoadRow | undefined>();
  // The balance whose trip is being registered, and the trip being deleted.
  const [tripFor, setTripFor] = useState<PendingBalanceRow | undefined>();
  const [deletingTrip, setDeletingTrip] = useState<BalanceTripRow | undefined>();
  const [filters, setFilters] = useState<LoadFilters>({ supplier: null, from: null, to: null });
  const { message, flash } = useFlashMessage();

  const shown = useMemo(() => filterLoads(rows, filters), [rows, filters]);
  const totals = useMemo(() => totalsOfLoads(shown), [shown]);
  const summary = useMemo(() => buildLoadSummary(shown), [shown]);
  const pendingBalances = useMemo(() => buildPendingBalances(balances, orders), [balances, orders]);
  const pending = useMemo(
    () => pendingEntries(buildPendingOrders(orders, kgPerBag), pendingBalances),
    [orders, kgPerBag, pendingBalances],
  );

  const editLoad = (load: LoadRow) => {
    // A load made without an order has its own form.
    if (isFreeLoad(load.lines)) {
      setEditingFree(load);
      setFreeOpen(true);
      return;
    }
    setEditing(load);
    setCreatingOrderId(null);
    setOpen(true);
  };

  /** "Nuevo cargue": a load that belongs to no order. */
  const createFreeLoad = () => {
    setEditingFree(undefined);
    setFreeOpen(true);
  };

  /** "Cargue" on an order: the loads of all its pending suppliers. */
  const createLoads = (orderId: number) => {
    setEditing(undefined);
    setCreatingOrderId(orderId);
    setOpen(true);
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Cargues"
        description="Cargues recibidos de los proveedores, con los productos, el costo y el número SIESA de cada uno."
      />

      <TabBar
        label="Vista de cargues"
        items={[
          { key: "pendientes", label: "Pendientes", count: pending.length },
          { key: "historial", label: "Historial" },
          { key: "resumen", label: "Resumen" },
        ]}
        active={tab}
        onSelect={setTab}
        idPrefix="loads-tab"
        panelId="loads-panel"
      />

      <div id="loads-panel" role="tabpanel" aria-labelledby={`loads-tab-${tab}`} className="space-y-5">
        {tab === "pendientes" ? (
          <PendingLoads
            entries={pending}
            today={today}
            canManage={canManage}
            onCreateLoad={createLoads}
            onCreateFreeLoad={createFreeLoad}
            onRegisterTrip={setTripFor}
            onDeleteTrip={setDeletingTrip}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
              <div>
                <Label htmlFor="load-supplier-filter" className="mb-1 block text-xs text-muted-foreground">
                  Proveedor
                </Label>
                <NativeSelect
                  id="load-supplier-filter"
                  className="h-11 md:h-9"
                  value={filters.supplier ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, supplier: isLoadSupplier(e.target.value) ? e.target.value : null }))}
                >
                  <option value="">Todos</option>
                  {LOAD_SUPPLIERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="load-from-filter" className="mb-1 block text-xs text-muted-foreground">
                  Desde
                </Label>
                <Input
                  id="load-from-filter"
                  type="date"
                  className="h-11 md:h-9"
                  value={filters.from ?? ""}
                  max={filters.to ?? undefined}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || null }))}
                />
              </div>
              <div>
                <Label htmlFor="load-to-filter" className="mb-1 block text-xs text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  id="load-to-filter"
                  type="date"
                  className="h-11 md:h-9"
                  value={filters.to ?? ""}
                  min={filters.from ?? undefined}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || null }))}
                />
              </div>
            </div>

            <p className="num text-sm text-muted-foreground" aria-live="polite">
              {totals.count} de {rows.length} cargues · {formatDecimal(totals.tons, 3)} t · {formatCop(totals.cost)}
            </p>

            {tab === "historial" ? (
              <LoadList
                rows={shown}
                balances={balances}
                canManage={canManage}
                onEdit={editLoad}
                onDelete={setDeleting}
                onDeleteTrip={setDeletingTrip}
              />
            ) : (
              <LoadSummary suppliers={summary} />
            )}
          </>
        )}
      </div>

      <FlashMessage message={message} />

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar cargue"
        description={deleting && `${deleting.supplier} · ${deleting.plate}`}
        warning={deleting ? `Se eliminará el cargue de ${deleting.supplier} del ${formatDisplayDate(deleting.date)}, con ${deleting.lines.length === 1 ? "su producto" : `sus ${deleting.lines.length} productos`}.` : ""}
        action={() => (deleting ? deleteLoadAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin cargue." }))}
        onClose={() => setDeleting(undefined)}
        onDone={flash}
      />

      <ConfirmDeleteDialog
        open={deletingTrip !== undefined}
        title="Eliminar viaje del saldo"
        description={deletingTrip && `${formatDisplayDate(deletingTrip.date)} · ${deletingTrip.plate}`}
        warning={
          deletingTrip
            ? `Se eliminará el viaje del ${formatDisplayDate(deletingTrip.date)} con ${deletingTrip.bags} ${deletingTrip.bags === 1 ? "bulto" : "bultos"}; esos bultos vuelven al saldo por llevar.`
            : ""
        }
        action={() => (deletingTrip ? deleteBalanceTripAction(deletingTrip.id) : Promise.resolve({ ok: false as const, error: "Sin viaje." }))}
        onClose={() => setDeletingTrip(undefined)}
        onDone={flash}
      />

      <SlideOver
        open={tripFor !== undefined}
        onOpenChange={(next) => !next && setTripFor(undefined)}
        title="Registrar faltante"
        description={tripFor ? `Saldo del pedido #${tripFor.orderId} · ${tripFor.supplier}` : undefined}
      >
        {tripFor && (
          <BalanceTripForm
            key={tripFor.balanceId}
            balance={tripFor}
            plates={plates}
            onCancel={() => setTripFor(undefined)}
            onDone={(msg) => {
              flash(msg);
              setTripFor(undefined);
            }}
          />
        )}
      </SlideOver>

      <SlideOver
        open={freeOpen}
        onOpenChange={setFreeOpen}
        title={editingFree ? "Editar cargue" : "Nuevo cargue"}
        description={editingFree ? `${editingFree.supplier} · ${formatDisplayDate(editingFree.date)}` : "Sin pedido"}
      >
        <FreeLoadForm
          key={editingFree ? `edit-${editingFree.id}` : "new"}
          load={editingFree}
          plates={plates}
          onCancel={() => setFreeOpen(false)}
          onDone={(msg) => {
            flash(msg);
            setFreeOpen(false);
          }}
        />
      </SlideOver>

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar cargue" : "Nuevo cargue"}
        description={editing ? `${editing.supplier} · ${formatDisplayDate(editing.date)}` : creatingOrderId === null ? undefined : `Pedido #${creatingOrderId}`}
      >
        {/* Keyed so a different load or order starts from fresh drafts. */}
        <LoadForm
          key={editing ? `edit-${editing.id}` : `new-${creatingOrderId}`}
          load={editing}
          orderId={creatingOrderId ?? undefined}
          plates={plates}
          orders={orders}
          kgPerBag={kgPerBag}
          balances={editing ? balances.filter((b) => b.loadId === editing.id) : undefined}
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
