"use client";

import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { deleteLoadAction } from "../application/load-actions";
import { buildPendingSections } from "../domain/load-pending";
import {
  filterLoads,
  formatCop,
  isLoadSupplier,
  LOAD_SUPPLIERS,
  totalsOfLoads,
  type LoadFilters,
  type LoadRow,
} from "../domain/load-rules";
import { LoadForm } from "./load-form";
import { LoadList } from "./load-list";
import { PendingLoads } from "./pending-loads";

/** Loads page: filters, totals, the list, the create / edit side sheet and the delete confirmation. */
export function LoadsView({
  rows,
  plates,
  orders,
  kgPerBag,
  presetOrderId,
  canManage,
  today,
}: {
  rows: readonly LoadRow[];
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
  const [open, setOpen] = useState(presetOrderId !== null);
  // The order whose loads are being created; an edit takes the orders of its load.
  const [creatingOrderId, setCreatingOrderId] = useState<number | null>(presetOrderId);
  const [editing, setEditing] = useState<LoadRow | undefined>();
  const [deleting, setDeleting] = useState<LoadRow | undefined>();
  const [filters, setFilters] = useState<LoadFilters>({ supplier: null, from: null, to: null });
  const { message, flash } = useFlashMessage();

  const shown = useMemo(() => filterLoads(rows, filters), [rows, filters]);
  const totals = useMemo(() => totalsOfLoads(shown), [shown]);
  const sections = useMemo(() => buildPendingSections(orders, kgPerBag), [orders, kgPerBag]);

  const editLoad = (load: LoadRow) => {
    setEditing(load);
    setCreatingOrderId(null);
    setOpen(true);
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

      <PendingLoads sections={sections} today={today} canManage={canManage} onCreateLoad={createLoads} />

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

      <LoadList rows={shown} canManage={canManage} onEdit={editLoad} onDelete={setDeleting} />

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
