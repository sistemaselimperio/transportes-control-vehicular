"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { productLabel } from "@/modules/orders/domain/catalog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { remainingBags, type BalanceTripRow, type LoadBalanceRow } from "../domain/load-balance";
import { groupLinesByOrder } from "../domain/load-lines";
import { formatCop, loadFooter, type LoadOrderBlock, type LoadRow } from "../domain/load-rules";
import { BalanceTrips } from "./balance-trips";

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

/** What each order of the load carries: its SIESA and supplier order numbers, its cost and the tons of each product. */
function LineDetails({ row }: { row: LoadRow }) {
  const groups = groupLinesByOrder(row.lines);
  return (
    <details className="group px-4 py-2.5">
      <summary className="num cursor-pointer rounded-sm text-xs text-muted-foreground outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/70">
        {groups.length} {groups.length === 1 ? "pedido" : "pedidos"} · costo y números
      </summary>
      <ul className="mt-2 space-y-2">
        {groups.map((g) => (
          <li key={g.orderId} className="rounded-lg border bg-background p-2.5 text-xs">
            <p className="text-sm font-medium">Pedido #{g.orderId}</p>
            <p className="num text-muted-foreground">
              SIESA {g.siesaNumbers.join(", ")} · Pedido proveedor {g.orderNumbers.join(", ")}
            </p>
            <p className="num text-muted-foreground">
              {formatDecimal(g.tons, 3)} t · {formatCop(g.cost)}
            </p>
            <ul className="mt-1.5 divide-y rounded-md border">
              {g.lines.map((l) => (
                <li key={l.id} className="flex items-baseline justify-between gap-3 px-2 py-1">
                  <span className="min-w-0">
                    {l.referenceName !== null ? (
                      productLabel({ code: l.referenceCode, name: l.referenceName })
                    ) : (
                      <span className="text-muted-foreground">Sin producto</span>
                    )}
                  </span>
                  <span className="num shrink-0 text-muted-foreground">{formatDecimal(l.tons, 3)} t</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The bags this load left behind: what is still to carry (and when) and the trips that carried the rest. */
function BalanceDetails({ balances, onDeleteTrip }: { balances: readonly LoadBalanceRow[]; onDeleteTrip?: (trip: BalanceTripRow) => void }) {
  return (
    <ul className="space-y-2 px-4 py-3 text-xs">
      {balances.map((b) => {
        const left = remainingBags(b);
        return (
          <li key={b.id} className="space-y-1.5 rounded-lg border bg-background p-2.5">
            <p className="num text-sm font-medium">
              Pedido #{b.orderId} · carga incompleta: {formatDecimal(b.bags, 0)} {b.bags === 1 ? "bulto" : "bultos"} por llevar aparte
            </p>
            <p className="num text-muted-foreground">
              {left > 0
                ? `Quedan ${formatDecimal(left, 0)} ${left === 1 ? "bulto" : "bultos"} · ${formatDisplayDate(b.scheduledDate)} · ${b.plate ?? "sin placa"}`
                : "Saldo llevado completo."}
            </p>
            <BalanceTrips trips={b.trips} onDelete={onDeleteTrip} />
          </li>
        );
      })}
    </ul>
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
  balances = [],
  canManage,
  onEdit,
  onDelete,
  onDeleteTrip,
}: {
  rows: readonly LoadRow[];
  /** The balances of every load: the ones of each row show under its orders. */
  balances?: readonly LoadBalanceRow[];
  canManage: boolean;
  onEdit: (row: LoadRow) => void;
  onDelete: (row: LoadRow) => void;
  onDeleteTrip?: (trip: BalanceTripRow) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No hay cargues para este filtro.</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((r) => {
        const footer = loadFooter(r.orders);
        const left = balances.filter((b) => b.loadId === r.id);
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

            {left.length > 0 && (
              <div className="border-t">
                <BalanceDetails balances={left} onDeleteTrip={canManage ? onDeleteTrip : undefined} />
              </div>
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
