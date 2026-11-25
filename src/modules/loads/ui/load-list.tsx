"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { productLabel } from "@/modules/orders/domain/catalog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { formatCop, loadFooter, type LoadOrderBlock, type LoadRow } from "../domain/load-rules";

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

/** "Agro Uno (La Esperanza), Agro Dos": the clients and fincas of an order. */
const clientsText = (order: LoadOrderBlock): string =>
  order.clients.map((c) => (c.locationName ? `${c.clientName} (${c.locationName})` : c.clientName)).join(", ") || "Sin clientes";

/** One order of the load: its number, clients, delivery day and window, and the products this load takes of it. */
function OrderBlock({ order }: { order: LoadOrderBlock }) {
  return (
    <li className="space-y-1.5 px-4 py-3 text-sm">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="num font-semibold">Pedido #{order.id}</span>
        <span className="min-w-0 text-muted-foreground">{clientsText(order)}</span>
      </p>
      <p className="num text-xs text-muted-foreground">
        Entrega {formatDisplayDate(order.deliveryDate)}
        {order.timeWindow ? ` · ${order.timeWindow}` : ""}
      </p>
      <ul className="divide-y rounded-lg border bg-background text-xs">
        {order.products.map((p) => (
          <li key={p.referenceId} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5">
            <span className="min-w-0">{p.label}</span>
            <span className="num shrink-0 text-muted-foreground">
              <span className="font-semibold text-foreground">{formatDecimal(p.bags, 0)}</span> bultos · {formatDecimal(p.tons, 3)} t
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The lines of a load as they were typed: product, order, tons, cost and numbers. */
function LineDetails({ row }: { row: LoadRow }) {
  const count = row.lines.length;
  return (
    <details className="group px-4 py-2.5">
      <summary className="num cursor-pointer rounded-sm text-xs text-muted-foreground outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/70">
        {count} {count === 1 ? "línea" : "líneas"} · costo y números
      </summary>
      <ul className="mt-2 space-y-2">
        {row.lines.map((l) => (
          <li key={l.id} className="rounded-lg border bg-background p-2.5 text-xs">
            <p className="text-sm font-medium">
              {l.referenceName !== null ? productLabel({ code: l.referenceCode, name: l.referenceName }) : <span className="font-normal text-muted-foreground">Sin producto</span>}
              <span className="num font-normal text-muted-foreground"> · Pedido #{l.orderId}</span>
            </p>
            <p className="num text-muted-foreground">
              {formatDecimal(l.tons, 3)} t · {formatCop(l.cost)}
            </p>
            <p className="num text-muted-foreground">
              SIESA {l.siesaNumber} · Pedido proveedor {l.orderNumber}
            </p>
          </li>
        ))}
      </ul>
    </details>
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

/**
 * One block per load. Header: plate, date, supplier, total tons and cost. Then each order the load takes
 * part of, with its clients, delivery day and the products (bags and tons) carried here. Footer: how many
 * orders and how many bags. Without `canManage` the blocks carry no edit / delete.
 */
export function LoadList({
  rows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: readonly LoadRow[];
  canManage: boolean;
  onEdit: (row: LoadRow) => void;
  onDelete: (row: LoadRow) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No hay cargues para este filtro.</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((r) => {
        const footer = loadFooter(r.orders);
        return (
          <li key={r.id} className="panel">
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

            {r.orders.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin pedidos.</p>
            ) : (
              <ul className="divide-y">
                {r.orders.map((o) => (
                  <OrderBlock key={o.id} order={o} />
                ))}
              </ul>
            )}

            <div className="border-t">
              <LineDetails row={r} />
            </div>
            {r.notes && <p className="line-clamp-2 border-t px-4 py-2.5 text-sm text-muted-foreground">{r.notes}</p>}

            <p className="num flex flex-wrap items-center justify-between gap-x-4 border-t bg-muted/40 px-4 py-2.5 text-sm font-semibold">
              <span>
                {footer.orders} {footer.orders === 1 ? "pedido" : "pedidos"}
              </span>
              <span>{formatDecimal(footer.bags, 0)} bultos</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
