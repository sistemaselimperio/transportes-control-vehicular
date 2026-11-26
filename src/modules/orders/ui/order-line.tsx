"use client";

import { Ban, Container, PackageCheck, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDisplayDate, formatShortDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { productLabel } from "../domain/catalog";
import { undoOrdersDeliveryAction } from "../application/order-actions";
import { clientNames, daysLate, pendingDay } from "../domain/order-days";
import { UndoDeliveryButton } from "./deliver-dialog";
import { bagsToKg, canEditOrder, kgToTons, orderLoadIds, orderStatusLabel, orderTotals, type OrderRow, type OrderStatus } from "../domain/order-rules";

/** Status as quiet text: only a loaded, a partially loaded or an annulled order says so; a pending one shows its day. */
const STATUS_TEXT: Record<OrderStatus, string> = {
  pendiente: "text-muted-foreground",
  cargado: "font-medium text-ok-foreground",
  entregado: "font-medium text-ok-foreground",
  anulado: "font-medium text-danger-foreground",
};
const PARTIAL_TEXT = "font-medium text-warn-foreground";

/** "#3, #5": the loads that took part of the order. */
const loadsLabel = (order: OrderRow): string => orderLoadIds(order).map((id) => `#${id}`).join(", ");

/** The pending order's dot: red when late, amber for today, none otherwise. */
function dotClass(order: OrderRow, today: string): string {
  if (order.status !== "pendiente") return "bg-transparent";
  const when = pendingDay(order.deliveryDate, today);
  return when === "atrasado" ? "bg-destructive" : when === "hoy" ? "bg-amber-500" : "bg-transparent";
}

/** "Hoy", "Mañana", "20 nov · hace 4 d" for a late pending order, or the plain day otherwise. */
function dayText(order: OrderRow, today: string): { label: string; className: string } {
  const day = formatShortDate(order.deliveryDate);
  if (order.status !== "pendiente") return { label: day, className: "text-foreground" };
  switch (pendingDay(order.deliveryDate, today)) {
    case "atrasado":
      return { label: `${day} · hace ${daysLate(order.deliveryDate, today)} d`, className: "font-medium text-destructive" };
    case "hoy":
      return { label: "Hoy", className: "font-medium text-warn-foreground" };
    case "manana":
      return { label: "Mañana", className: "text-foreground" };
    case "despues":
      return { label: day, className: "text-foreground" };
  }
}

/**
 * One order on one compact line: dot, number, delivery day and window, clients, status and bags, then
 * its actions. The line opens a side panel with the products and their weight (current kg per bag).
 */
export function OrderLine({
  order,
  today,
  kgPerBag,
  canManage,
  canCreateLoad,
  canDeliver,
  deliverable,
  onEdit,
  onAnnul,
  onDeliver,
  onFlash,
}: {
  order: OrderRow;
  /** Colombia's current day. */
  today: string;
  kgPerBag: number;
  canManage: boolean;
  /** The user manages loads: a pending order offers "Crear cargue". */
  canCreateLoad: boolean;
  /** The user may deliver orders (and undo it). */
  canDeliver: boolean;
  /** The order is loaded completely and has no balance left to carry. */
  deliverable: boolean;
  onEdit: (order: OrderRow) => void;
  onAnnul: (order: OrderRow) => void;
  onDeliver: (order: OrderRow) => void;
  /** Reports the result of undoing a delivery. */
  onFlash: (message: string) => void;
}) {
  const [detail, setDetail] = useState(false);
  const totals = orderTotals(order.lines, kgPerBag);
  // An order a load already took part of is locked, but a partial one still needs its remaining loads.
  const editable = canEditOrder(order.status, order.loads.length > 0);
  const loadable = order.status === "pendiente" && canCreateLoad;
  const names = clientNames(order);
  const day = dayText(order, today);
  const annulled = order.status === "anulado";
  const delivered = order.status === "entregado";
  const canMarkDelivered = canDeliver && deliverable;
  const canUndoDelivery = canDeliver && delivered;
  const hasDeliveryAction = canMarkDelivered || canUndoDelivery;
  const hasActions = ((editable || loadable) && (canManage || canCreateLoad)) || hasDeliveryAction;

  return (
    <li>
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Pedido ${order.id}, ${orderStatusLabel(order)}, ver detalle`}
          onClick={() => setDetail(true)}
          className={cn(
            "grid min-h-14 min-w-0 flex-1 cursor-pointer grid-cols-[0.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 pl-4 text-left text-sm transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground md:grid-cols-[0.5rem_3.5rem_10rem_minmax(0,1fr)_6rem_4.5rem] md:py-0",
            annulled && "text-muted-foreground",
          )}
        >
          {/* The dot keeps its slot even when transparent, so every number starts on one edge. */}
          <span aria-hidden className={cn("size-2 rounded-full max-md:row-span-2", dotClass(order, today))} />
          <span className="flex min-w-0 items-baseline gap-2 md:contents">
            <span className={cn("num font-semibold", annulled && "line-through")}>#{order.id}</span>
            <span className="min-w-0 truncate">
              <span className={annulled ? undefined : day.className}>{day.label}</span>
              {order.timeWindow && <span className="text-muted-foreground"> · {order.timeWindow}</span>}
            </span>
          </span>
          <span className="num text-right font-semibold md:order-last">
            {formatDecimal(totals.bags, 0)}
            <span className="font-normal text-muted-foreground md:sr-only"> bultos</span>
          </span>
          <span className="col-start-2 flex min-w-0 items-baseline gap-2 md:contents">
            <span className="min-w-0 truncate text-muted-foreground md:text-foreground" title={names.join(", ")}>
              {names.join(", ") || "Sin clientes"}
            </span>
            <span className={cn("shrink-0 text-xs md:text-sm", order.partial ? PARTIAL_TEXT : STATUS_TEXT[order.status])}>
              {orderStatusLabel(order)}
              {order.deliveredAt && <span className="num font-normal"> · {formatShortDate(order.deliveredAt)}</span>}
              {order.loads.length > 0 && <span className="num font-normal text-muted-foreground"> {loadsLabel(order)}</span>}
            </span>
          </span>
        </button>

        {hasActions && (
          <div className="flex shrink-0 items-center gap-0.5">
            {canMarkDelivered && (
              <Button
                variant="outline"
                className="h-11 px-3 md:h-8"
                aria-label={`Entregar pedido ${order.id}`}
                onClick={() => onDeliver(order)}
              >
                <PackageCheck aria-hidden />
                <span className="max-sm:sr-only">Entregar</span>
              </Button>
            )}
            {canUndoDelivery && (
              <UndoDeliveryButton
                className="h-11 px-3 md:h-8"
                label={`Deshacer entrega del pedido ${order.id}`}
                run={() => undoOrdersDeliveryAction([order.id])}
                onDone={onFlash}
              />
            )}
            {loadable && (
              <Link
                href={`/cargues?nuevo=1&pedido=${order.id}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-3 md:h-8" })}
                aria-label={`Crear cargue con el pedido ${order.id}`}
              >
                <Container aria-hidden />
                <span className="max-sm:sr-only">Cargue</span>
              </Link>
            )}
            {canManage && editable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground hover:text-foreground md:size-8"
                  aria-label={`Editar pedido ${order.id}`}
                  title="Editar"
                  onClick={() => onEdit(order)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground hover:text-destructive md:size-8"
                  aria-label={`Anular pedido ${order.id}`}
                  title="Anular"
                  onClick={() => onAnnul(order)}
                >
                  <Ban aria-hidden />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <SlideOver
        open={detail}
        onOpenChange={setDetail}
        title={`Pedido #${order.id}`}
        description={`${orderStatusLabel(order)} · entrega ${day.label}${order.timeWindow ? ` · ${order.timeWindow}` : ""}`}
      >
        <OrderDetail
          order={order}
          kgPerBag={kgPerBag}
          actions={
            hasActions ? (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {canMarkDelivered && (
                  <Button
                    className="h-11 px-4 md:h-10"
                    onClick={() => {
                      setDetail(false);
                      onDeliver(order);
                    }}
                  >
                    <PackageCheck aria-hidden />
                    Entregar
                  </Button>
                )}
                {canUndoDelivery && (
                  <UndoDeliveryButton
                    className="h-11 px-4 md:h-10"
                    label={`Deshacer entrega del pedido ${order.id}`}
                    run={() => undoOrdersDeliveryAction([order.id])}
                    onDone={(message) => {
                      setDetail(false);
                      onFlash(message);
                    }}
                  />
                )}
                {loadable && (
                  <Link href={`/cargues?nuevo=1&pedido=${order.id}`} className={buttonVariants({ className: "h-11 px-4 md:h-10" })}>
                    <Container aria-hidden />
                    Crear cargue
                  </Link>
                )}
                {canManage && editable && (
                  <>
                    <Button
                      variant="outline"
                      className="h-11 px-4 md:h-10"
                      onClick={() => {
                        setDetail(false);
                        onEdit(order);
                      }}
                    >
                      <Pencil aria-hidden />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-11 px-4 text-destructive hover:bg-destructive-soft hover:text-destructive md:h-10"
                      onClick={() => {
                        setDetail(false);
                        onAnnul(order);
                      }}
                    >
                      <Ban aria-hidden />
                      Anular
                    </Button>
                  </>
                )}
              </div>
            ) : null
          }
        />
      </SlideOver>
    </li>
  );
}

/** Who the order is for, its products with bags, kilograms and tons, the total, the note and the actions. */
function OrderDetail({ order, kgPerBag, actions }: { order: OrderRow; kgPerBag: number; actions: React.ReactNode }) {
  const totals = orderTotals(order.lines, kgPerBag);
  const names = clientNames(order);
  return (
    <div className="space-y-5">
      <div className="space-y-1 text-sm">
        <p className="font-semibold">{names.join(", ") || "Sin clientes"}</p>
        {order.loads.length > 0 && (
          <p className="num text-muted-foreground">
            {order.loads.length === 1 ? "Cargue" : "Cargues"} {loadsLabel(order)}
          </p>
        )}
        {order.deliveredAt && (
          <p className="num font-medium text-ok-foreground">Entregado el {formatDisplayDate(order.deliveredAt)}</p>
        )}
        {order.partial && (
          <p className="text-warn-foreground">
            Cargado parcial: falta cargar lo de {order.pendingSuppliers.join(" y ")}.
          </p>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-2 text-left font-normal">Producto</th>
            <th scope="col" className="py-2 text-right font-normal">Bultos</th>
            <th scope="col" className="py-2 pl-3 text-right font-normal">Kg</th>
            <th scope="col" className="py-2 pl-3 text-right font-normal">t</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {order.lines.map((line) => {
            const kg = bagsToKg(line.bags, kgPerBag);
            return (
              <tr key={line.id}>
                <td className="py-2 pr-3">
                  {productLabel({ code: line.referenceCode, name: line.referenceName })}
                  {line.locationName && <span className="block text-xs text-muted-foreground">Finca {line.locationName}</span>}
                  {line.supplier !== null && (
                    <span className="block text-xs text-muted-foreground">
                      {line.supplier}
                      {order.loads.length > 0 && <LineLoadState order={order} supplier={line.supplier} />}
                    </span>
                  )}
                </td>
                <td className="num py-2 text-right">{formatDecimal(line.bags, 0)}</td>
                <td className="num py-2 pl-3 text-right">{formatDecimal(kg, 2)}</td>
                <td className="num py-2 pl-3 text-right">{formatDecimal(kgToTons(kg), 3)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <th scope="row" className="py-2 text-left">Total</th>
            <td className="num py-2 text-right">{formatDecimal(totals.bags, 0)}</td>
            <td className="num py-2 pl-3 text-right">{formatDecimal(totals.kg, 2)}</td>
            <td className="num py-2 pl-3 text-right">{formatDecimal(totals.tons, 3)}</td>
          </tr>
        </tfoot>
      </table>

      {order.note && <p className="rounded-lg bg-warn/40 px-3 py-2 text-sm text-warn-foreground">{order.note}</p>}

      {actions}
    </div>
  );
}

/** " · cargado #3" or " · pendiente": where the products of a supplier stand once the order has loads. */
function LineLoadState({ order, supplier }: { order: OrderRow; supplier: NonNullable<OrderRow["lines"][number]["supplier"]> }) {
  const load = order.loads.find((l) => l.supplier === supplier);
  return load ? (
    <span className="num text-ok-foreground"> · cargado #{load.loadId}</span>
  ) : (
    <span className="text-warn-foreground"> · pendiente</span>
  );
}
