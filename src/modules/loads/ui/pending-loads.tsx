"use client";

import { ChevronRight, Plus, Truck } from "lucide-react";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { daysLate, pendingDay, type PendingDay } from "@/modules/orders/domain/order-days";
import { formatShortDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { balanceLeftText, dayMonth, type BalanceTripRow, type PendingBalanceRow, type PendingEntry } from "../domain/load-balance";
import type { PendingOrderRow } from "../domain/load-pending";
import { BalanceTrips } from "./balance-trips";

const tons = (value: number) => formatDecimal(value, 3);

/** Only a late or a today delivery carries colour. */
const DAY_TEXT: Record<PendingDay, string> = {
  atrasado: "font-medium text-destructive",
  hoy: "font-medium text-warn-foreground",
  manana: "text-foreground",
  despues: "text-foreground",
};

function dayLabel(date: string, today: string): string {
  switch (pendingDay(date, today)) {
    case "atrasado":
      return `${formatShortDate(date)} · hace ${daysLate(date, today)} d`;
    case "hoy":
      return "Hoy";
    case "manana":
      return "Mañana";
    case "despues":
      return formatShortDate(date);
  }
}

/**
 * What is still to load: one row per order with a part pending, oldest delivery first, naming its
 * pending suppliers. Clicking a row opens the whole order split by supplier; "Cargue" opens the load
 * form of that order, which covers all its pending suppliers. Among them, one row per balance (the bags a
 * truck left behind) with bags still to carry, by its scheduled day: "Registrar faltante" records a trip.
 * Without `canManage` the rows are read-only.
 */
export function PendingLoads({
  entries,
  today,
  canManage,
  onCreateLoad,
  onCreateFreeLoad,
  onRegisterTrip,
  onDeleteTrip,
}: {
  entries: readonly PendingEntry[];
  /** Colombia's current day. */
  today: string;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
  /** "Nuevo cargue": a load made without an order. */
  onCreateFreeLoad: () => void;
  onRegisterTrip: (balance: PendingBalanceRow) => void;
  onDeleteTrip: (trip: BalanceTripRow) => void;
}) {
  const orders = entries.flatMap((e) => (e.kind === "order" ? [e.row] : []));
  const balances = entries.flatMap((e) => (e.kind === "balance" ? [e.row] : []));
  const bags = orders.reduce((sum, o) => sum + o.bags, 0);
  const totalTons = orders.reduce((sum, o) => sum + o.tons, 0);
  return (
    <section aria-labelledby="pending-loads-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="pending-loads-title" className="sr-only">
          Por cargar
        </h2>
        {canManage && (
          <Button type="button" className="h-11 md:h-9" onClick={onCreateFreeLoad}>
            <Plus aria-hidden /> Nuevo cargue
          </Button>
        )}
        {entries.length > 0 && (
          <p className="num text-sm text-muted-foreground">
            {[
              orders.length > 0 && `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"} · ${formatDecimal(bags, 0)} bultos · ${tons(totalTons)} t`,
              balances.length > 0 &&
                `${balances.length} ${balances.length === 1 ? "saldo" : "saldos"} · ${formatDecimal(
                  balances.reduce((sum, b) => sum + b.remaining, 0),
                  0,
                )} bultos por llevar`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="panel px-4 py-6 text-center text-sm text-muted-foreground">No hay pedidos pendientes: todo lo pedido ya tiene cargue.</p>
      ) : (
        <ul className="panel divide-y text-sm">
          {entries.map((e) =>
            e.kind === "order" ? (
              <OrderItem key={`order-${e.row.id}`} order={e.row} today={today} canManage={canManage} onCreateLoad={onCreateLoad} />
            ) : (
              <BalanceItem
                key={`balance-${e.row.balanceId}`}
                balance={e.row}
                today={today}
                canManage={canManage}
                onRegisterTrip={onRegisterTrip}
                onDeleteTrip={onDeleteTrip}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

/** One pending order: the row opens its detail, the button opens its load form. */
function OrderItem({
  order: o,
  today,
  canManage,
  onCreateLoad,
}: {
  order: PendingOrderRow;
  today: string;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const whenText = [dayLabel(o.deliveryDate, today), o.timeWindow].filter(Boolean).join(" · ");
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-baseline gap-2">
            <span className="num font-semibold">Pedido #{o.id}</span>
            <span aria-hidden className="text-muted-foreground">·</span>
            <span className={cn("num shrink-0", DAY_TEXT[pendingDay(o.deliveryDate, today)])}>{dayLabel(o.deliveryDate, today)}</span>
          </span>
          <span className="block truncate text-muted-foreground" title={o.clients.join(", ")}>
            {o.clients.join(", ") || "Sin clientes"}
          </span>
          <span className="num flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {formatDecimal(o.bags, 0)} bultos · {tons(o.tons)} t{o.timeWindow ? ` · ${o.timeWindow}` : ""}
            </span>
            {o.suppliers.map((supplier) => (
              <span key={supplier} className="rounded-full border px-1.5 py-px text-[11px] font-medium text-foreground">
                {supplier}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {canManage && (
        <div className="flex shrink-0 items-center pr-3">
          <Button
            variant="outline"
            className="h-11 px-3 md:h-8"
            onClick={() => onCreateLoad(o.id)}
            aria-label={`Crear cargue del pedido #${o.id} (${o.suppliers.join(" + ")})`}
          >
            <Truck aria-hidden />
            Cargue
          </Button>
        </div>
      )}
      <SlideOver open={open} onOpenChange={setOpen} title={`Pedido #${o.id}`} description={whenText}>
        <div className="space-y-4">
          {o.places.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin clientes</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {o.places.map((place) => (
                <li key={place.clientName}>
                  <p className="text-muted-foreground">{place.clientName}</p>
                  <p className="font-medium">{place.fincas.join(", ") || "Sin finca"}</p>
                </li>
              ))}
            </ul>
          )}
          {o.parts.map((part) => (
            <section key={part.supplier} aria-label={part.supplier} className="space-y-1">
              <h3 className="flex items-baseline justify-between gap-3 border-b pb-1 text-sm font-semibold">
                <span>
                  {part.supplier}
                  {!part.pending && <span className="ml-2 text-xs font-normal text-muted-foreground">Ya cargado</span>}
                </span>
                <span className="num shrink-0 font-normal text-muted-foreground">
                  {formatDecimal(part.bags, 0)} bultos · {tons(part.tons)} t
                </span>
              </h3>
              <ul className={cn("divide-y text-sm", !part.pending && "text-muted-foreground")}>
                {part.products.map((p) => (
                  <li key={p.referenceId} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">{p.label}</span>
                    <span className="num shrink-0 text-muted-foreground">
                      <span className={cn("font-semibold", part.pending && "text-foreground")}>{formatDecimal(p.bags, 0)}</span> bultos · {tons(p.tons)} t
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SlideOver>
    </li>
  );
}

/** One balance with bags still to carry: the row opens its trips, the button registers a new one. */
function BalanceItem({
  balance: b,
  today,
  canManage,
  onRegisterTrip,
  onDeleteTrip,
}: {
  balance: PendingBalanceRow;
  today: string;
  canManage: boolean;
  onRegisterTrip: (balance: PendingBalanceRow) => void;
  onDeleteTrip: (trip: BalanceTripRow) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-baseline gap-2">
            <span className="num font-semibold">Pedido #{b.orderId}</span>
            <span aria-hidden className="text-muted-foreground">·</span>
            <span className={cn("num shrink-0", DAY_TEXT[pendingDay(b.scheduledDate, today)])}>{dayLabel(b.scheduledDate, today)}</span>
            <span className="rounded-full border px-1.5 py-px text-[11px] font-medium">Saldo</span>
          </span>
          <span className="block truncate text-muted-foreground" title={b.clients.join(", ")}>
            {b.clients.join(", ") || "Sin clientes"}
          </span>
          <span className="num block text-xs text-muted-foreground">
            {balanceLeftText(b)}
            {b.rescheduled ? ` · reprogramado desde ${dayMonth(b.originalDate)}` : ""}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {canManage && (
        <div className="flex shrink-0 items-center pr-3">
          <Button
            variant="outline"
            className="h-11 px-3 md:h-8"
            onClick={() => onRegisterTrip(b)}
            aria-label={`Registrar faltante del pedido #${b.orderId} (${b.supplier})`}
          >
            <Truck aria-hidden />
            Registrar faltante
          </Button>
        </div>
      )}
      <SlideOver open={open} onOpenChange={setOpen} title={`Saldo del pedido #${b.orderId}`} description={`${b.supplier} · ${balanceLeftText(b)}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{b.clients.join(", ") || "Sin clientes"}</p>
          <section aria-label="Viajes del saldo" className="space-y-1.5">
            <h3 className="border-b pb-1 text-sm font-semibold">Viajes registrados</h3>
            {b.trips.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay viajes de este saldo.</p>
            ) : (
              <BalanceTrips trips={b.trips} onDelete={canManage ? onDeleteTrip : undefined} />
            )}
          </section>
        </div>
      </SlideOver>
    </li>
  );
}
