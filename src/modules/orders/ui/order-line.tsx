"use client";

import { Ban, Container, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { productLabel } from "../domain/catalog";
import { clientNames, daysLate, pendingDay } from "../domain/order-days";
import { bagsToKg, canEditOrder, kgToTons, ORDER_STATUS_LABELS, orderTotals, type OrderRow, type OrderStatus } from "../domain/order-rules";

/** Status as quiet text: only a loaded or an annulled order says so; a pending one shows its day. */
const STATUS_TEXT: Record<OrderStatus, string> = {
  pendiente: "text-muted-foreground",
  cargado: "font-medium text-ok-foreground",
  anulado: "font-medium text-danger-foreground",
};

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
  onEdit,
  onAnnul,
}: {
  order: OrderRow;
  /** Colombia's current day. */
  today: string;
  kgPerBag: number;
  canManage: boolean;
  /** The user manages loads: a pending order offers "Crear cargue". */
  canCreateLoad: boolean;
  onEdit: (order: OrderRow) => void;
  onAnnul: (order: OrderRow) => void;
}) {
  const [detail, setDetail] = useState(false);
  const totals = orderTotals(order.lines, kgPerBag);
  const editable = canEditOrder(order.status);
  const names = clientNames(order);
  const day = dayText(order, today);
  const annulled = order.status === "anulado";

  return (
    <li>
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Pedido ${order.id}, ${ORDER_STATUS_LABELS[order.status]}, ver detalle`}
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
            <span className={cn("shrink-0 text-xs md:text-sm", STATUS_TEXT[order.status])}>
              {ORDER_STATUS_LABELS[order.status]}
              {order.loadId !== null && <span className="num font-normal text-muted-foreground"> #{order.loadId}</span>}
            </span>
          </span>
        </button>

        {editable && (canManage || canCreateLoad) && (
          <div className="flex shrink-0 items-center gap-0.5">
            {canCreateLoad && (
              <Link
                href={`/cargues?nuevo=1&pedido=${order.id}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-3 md:h-8" })}
                aria-label={`Crear cargue con el pedido ${order.id}`}
              >
                <Container aria-hidden />
                <span className="max-sm:sr-only">Cargue</span>
              </Link>
            )}
            {canManage && (
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
        description={`${ORDER_STATUS_LABELS[order.status]} · entrega ${day.label}${order.timeWindow ? ` · ${order.timeWindow}` : ""}`}
      >
        <OrderDetail
          order={order}
          kgPerBag={kgPerBag}
          actions={
            editable && (canManage || canCreateLoad) ? (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {canCreateLoad && (
                  <Link href={`/cargues?nuevo=1&pedido=${order.id}`} className={buttonVariants({ className: "h-11 px-4 md:h-10" })}>
                    <Container aria-hidden />
                    Crear cargue
                  </Link>
                )}
                {canManage && (
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
        {order.loadId !== null && <p className="num text-muted-foreground">Cargue #{order.loadId}</p>}
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
