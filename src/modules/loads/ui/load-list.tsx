"use client";

import { PackageCheck, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { undoLoadDeliveryAction } from "@/modules/orders/application/order-actions";
import { UndoDeliveryButton } from "@/modules/orders/ui/deliver-dialog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { remainingBags, type BalanceTripRow, type LoadBalanceRow } from "../domain/load-balance";
import { loadDeliveryState } from "../domain/load-delivery";
import { isFreeLoad } from "../domain/load-lines";
import { formatCop, loadFooter, type LoadRow } from "../domain/load-rules";
import { LoadDetail } from "./load-detail";

/** The plate links to the vehicle's file while the vehicle still exists. */
function Plate({ row }: { row: LoadRow }) {
  if (row.vehicleId === null) return <span className="plate"><PlateText plate={row.plate} /></span>;
  return (
    <Link
      href={`/flota/${encodeURIComponent(row.plate)}`}
      className="plate outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      <PlateText plate={row.plate} />
    </Link>
  );
}

function RowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: LoadRow;
  onEdit: (row: LoadRow) => void;
  onDelete: (row: LoadRow) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:size-9"
        aria-label={`Editar cargue de ${row.supplier} del ${formatDisplayDate(row.date)}`}
        title="Editar"
        onClick={() => onEdit(row)}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-destructive md:size-9"
        aria-label={`Eliminar cargue de ${row.supplier} del ${formatDisplayDate(row.date)}`}
        title="Eliminar"
        onClick={() => onDelete(row)}
      >
        <Trash2 aria-hidden />
      </Button>
    </>
  );
}

/** One load: a compact card (plate, supplier, date, tons, cost, actions) whose detail opens in a side sheet. */
function LoadCard({
  row: r,
  balances: left,
  canManage,
  canDeliver,
  onEdit,
  onDelete,
  onDeleteTrip,
  onDeliver,
  onFlash,
}: {
  row: LoadRow;
  /** Every balance: those of the orders of this load decide whether it can be delivered. */
  balances: readonly LoadBalanceRow[];
  canManage: boolean;
  canDeliver: boolean;
  onEdit: (row: LoadRow) => void;
  onDelete: (row: LoadRow) => void;
  onDeleteTrip?: (trip: BalanceTripRow) => void;
  onDeliver: (row: LoadRow) => void;
  onFlash: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const footer = loadFooter(r.orders);
  const free = isFreeLoad(r.lines);
  const mine = left.filter((b) => b.loadId === r.id);
  const toCarry = mine.reduce((sum, b) => sum + remainingBags(b), 0);
  const delivery = loadDeliveryState(r.orders, left);
  // The amber of a pending balance wins over the green of a delivered load.
  return (
    <li className={cn("panel", toCarry > 0 ? "border-l-4 border-l-warn" : delivery.delivered && "border-l-4 border-l-ok")} title={toCarry > 0 ? `Faltan ${formatDecimal(toCarry, 0)} bultos del saldo` : undefined}>
      <div className="flex items-start justify-between gap-2 border-b bg-muted/60 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Plate row={r} />
            <span className="font-medium">{r.supplier}</span>
          </div>
          <p className="num text-sm text-muted-foreground">{formatDisplayDate(r.date)}</p>
          <p className="num text-sm font-semibold">
            {formatDecimal(r.tons, 3)} t · {formatCop(r.cost)}
          </p>
        </div>
        {canManage && (
          <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
            <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>

      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="num flex min-h-11 w-full cursor-pointer items-center justify-between gap-x-4 bg-muted/40 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span>
          {free ? "Sin pedido" : `${footer.orders} ${footer.orders === 1 ? "pedido" : "pedidos"}`}
          {toCarry > 0 && <span className="sr-only">, faltan {formatDecimal(toCarry, 0)} bultos del saldo</span>}
        </span>
        <span className="flex items-center gap-2">
          {free ? `${formatDecimal(Math.round(r.tons * 1000), 0)} kg` : `${formatDecimal(footer.bags, 0)} bultos`}
          <span className="sr-only">Ver detalle</span>
        </span>
      </button>

      {canDeliver && !free && r.orders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
          {delivery.delivered ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-medium text-ok-foreground">
                <PackageCheck aria-hidden className="size-4" />
                Entregado
              </p>
              <UndoDeliveryButton
                className="h-11 px-3 md:h-8"
                label={`Deshacer entrega del cargue de ${r.supplier} del ${formatDisplayDate(r.date)}`}
                run={() => undoLoadDeliveryAction(r.id)}
                onDone={onFlash}
              />
            </>
          ) : (
            <>
              <p id={`load-${r.id}-delivery`} className="min-w-0 flex-1 text-xs text-muted-foreground">
                {delivery.reason ?? ""}
              </p>
              <span title={delivery.reason}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-3 md:h-8"
                  disabled={!delivery.deliverable}
                  aria-describedby={delivery.reason ? `load-${r.id}-delivery` : undefined}
                  aria-label={`Entregar cargue de ${r.supplier} del ${formatDisplayDate(r.date)}`}
                  onClick={() => onDeliver(r)}
                >
                  <PackageCheck aria-hidden />
                  Entregar
                </Button>
              </span>
            </>
          )}
        </div>
      )}

      <SlideOver open={open} onOpenChange={setOpen} title={`Cargue ${r.supplier} · ${r.plate}`} description={formatDisplayDate(r.date)}>
        <LoadDetail row={r} balances={mine} onDeleteTrip={canManage ? onDeleteTrip : undefined} />
      </SlideOver>
    </li>
  );
}

/**
 * One compact card per load (its orders, balances, lines and notes open in a side sheet). Header: plate, date, supplier, total tons and cost. Then each order the load takes
 * part of, with its clients, delivery day and the products (bags and tons) carried here. Footer: how many
 * orders and how many bags. Without `canManage` the blocks carry no edit / delete.
 */
export function LoadList({
  rows,
  balances = [],
  canManage,
  canDeliver,
  onEdit,
  onDelete,
  onDeleteTrip,
  onDeliver,
  onFlash,
}: {
  rows: readonly LoadRow[];
  /** The balances of every load: the ones of each row show under its orders. */
  balances?: readonly LoadBalanceRow[];
  canManage: boolean;
  /** The user may deliver orders: loads with orders offer "Entregar". */
  canDeliver: boolean;
  onEdit: (row: LoadRow) => void;
  onDelete: (row: LoadRow) => void;
  onDeleteTrip?: (trip: BalanceTripRow) => void;
  onDeliver: (row: LoadRow) => void;
  onFlash: (message: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No hay cargues para este filtro.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {rows.map((r) => (
        <LoadCard
          key={r.id}
          row={r}
          balances={balances}
          canManage={canManage}
          canDeliver={canDeliver}
          onEdit={onEdit}
          onDelete={onDelete}
          onDeleteTrip={onDeleteTrip}
          onDeliver={onDeliver}
          onFlash={onFlash}
        />
      ))}
    </ul>
  );
}
