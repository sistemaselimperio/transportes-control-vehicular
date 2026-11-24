"use client";

import { Ban, CircleCheck, Clock, Container, Pencil } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { productLabel } from "../domain/catalog";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import {
  bagsToKg,
  canEditOrder,
  kgToTons,
  ORDER_STATUS_LABELS,
  orderTotals,
  type OrderRow,
  type OrderStatus,
} from "../domain/order-rules";

const PILL =
  "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset";

const PILL_STYLES: Record<OrderStatus, string> = {
  pendiente: "bg-muted text-muted-foreground ring-border",
  cargado: "bg-ok text-ok-foreground ring-ok-foreground/25",
  anulado: "bg-danger text-danger-foreground ring-danger-foreground/25",
};

const PILL_ICONS = { pendiente: Clock, cargado: CircleCheck, anulado: Ban } as const;

/** Colored pill of an order status; the label always carries the meaning. */
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const Icon = PILL_ICONS[status];
  return (
    <span className={cn(PILL, PILL_STYLES[status])}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const HEADERS = ["Cliente", "Finca", "Referencia", "Bultos", "Kg", "Toneladas"] as const;
const NUMERIC = new Set<string>(["Bultos", "Kg", "Toneladas"]);

/**
 * One order as a block, like the Excel template: header, a table of lines and its total. Weights are
 * computed here with the current kg per bag; they are never stored.
 */
export function OrderBlock({
  order,
  kgPerBag,
  canManage,
  canCreateLoad,
  onEdit,
  onAnnul,
}: {
  order: OrderRow;
  kgPerBag: number;
  canManage: boolean;
  /** The user manages loads: a pending order offers "Crear cargue". */
  canCreateLoad: boolean;
  onEdit: (order: OrderRow) => void;
  onAnnul: (order: OrderRow) => void;
}) {
  const totals = orderTotals(order.lines, kgPerBag);
  const editable = canEditOrder(order.status);

  return (
    <article
      className={cn("panel overflow-hidden", order.status === "anulado" && "opacity-70")}
      aria-label={`Pedido #${order.id}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Pedido #{order.id}</h2>
            <OrderStatusPill status={order.status} />
          </div>
          <p className="num text-sm text-muted-foreground">
            Entrega {formatDisplayDate(order.deliveryDate)}
            {order.timeWindow && ` · ${order.timeWindow}`}
            {order.loadId !== null && ` · Cargue #${order.loadId}`}
          </p>
          {order.note && <p className="text-sm text-muted-foreground">{order.note}</p>}
        </div>
        {editable && (canManage || canCreateLoad) && (
          <div className="-mt-1 -mr-2 flex shrink-0 flex-wrap items-center gap-1">
            {canCreateLoad && (
              <Link
                href={`/cargues?nuevo=1&pedido=${order.id}`}
                className={buttonVariants({ variant: "outline", className: "h-11 px-3 md:h-9" })}
              >
                <Container aria-hidden />
                Crear cargue
              </Link>
            )}
            {canManage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-9"
                  aria-label={`Editar pedido ${order.id}`}
                  title="Editar"
                  onClick={() => onEdit(order)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-destructive md:size-9"
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
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left">
            <tr className="border-b">
              {HEADERS.map((h) => (
                <th key={h} scope="col" className={cn("micro-label px-4 py-2.5 font-medium", NUMERIC.has(h) && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {order.lines.map((line) => {
              const kg = bagsToKg(line.bags, kgPerBag);
              return (
                <tr key={line.id}>
                  <td className="px-4 py-2.5 font-medium">{line.clientName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{line.locationName ?? "—"}</td>
                  <td className="px-4 py-2.5">{productLabel({ code: line.referenceCode, name: line.referenceName })}</td>
                  <td className="num px-4 py-2.5 text-right">{formatDecimal(line.bags, 0)}</td>
                  <td className="num px-4 py-2.5 text-right">{formatDecimal(kg, 2)}</td>
                  <td className="num px-4 py-2.5 text-right">{formatDecimal(kgToTons(kg), 3)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50 font-semibold">
              <th scope="row" colSpan={3} className="px-4 py-2.5 text-left">
                Total del pedido
              </th>
              <td className="num px-4 py-2.5 text-right">{formatDecimal(totals.bags, 0)}</td>
              <td className="num px-4 py-2.5 text-right">{formatDecimal(totals.kg, 2)}</td>
              <td className="num px-4 py-2.5 text-right">{formatDecimal(totals.tons, 3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
