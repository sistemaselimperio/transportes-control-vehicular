"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { daysLate, pendingDay, type PendingDay } from "@/modules/orders/domain/order-days";
import { formatShortDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { PendingOrderRow, PendingSection } from "../domain/load-pending";

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
 * What is still to load, one section per supplier with its totals and one row per order that has a part
 * of it pending (a mixed order shows in each of its suppliers). Clicking a row opens the whole order;
 * "Cargue" opens the load form of that order, which covers all its pending suppliers. Without
 * `canManage` the rows are read-only.
 */
export function PendingLoads({
  sections,
  today,
  canManage,
  onCreateLoad,
}: {
  sections: readonly PendingSection[];
  /** Colombia's current day. */
  today: string;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  return (
    <section aria-labelledby="pending-loads-title" className="space-y-3">
      <h2 id="pending-loads-title" className="text-base font-semibold">
        Por cargar
      </h2>
      {sections.length === 0 ? (
        <p className="panel px-4 py-6 text-center text-sm text-muted-foreground">No hay pedidos pendientes: todo lo pedido ya tiene cargue.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <SupplierSection key={s.supplier} section={s} today={today} canManage={canManage} onCreateLoad={onCreateLoad} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SupplierSection({
  section: s,
  today,
  canManage,
  onCreateLoad,
}: {
  section: PendingSection;
  today: string;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  return (
    <li className="panel flex flex-col">
      <div className="space-y-0.5 border-b px-4 py-3">
        <h3 className="text-base font-semibold">{s.supplier}</h3>
        <p className="num text-sm text-muted-foreground">
          {s.orders.length} {s.orders.length === 1 ? "pedido" : "pedidos"} · {formatDecimal(s.bags, 0)} bultos · {tons(s.tons)} t
        </p>
      </div>
      <ul className="divide-y text-sm">
        {s.orders.map((o) => (
          <OrderItem key={o.id} order={o} supplier={s.supplier} today={today} canManage={canManage} onCreateLoad={onCreateLoad} />
        ))}
      </ul>
    </li>
  );
}

/** One order of a section: the row opens its detail, the button opens its load form. */
function OrderItem({
  order: o,
  supplier,
  today,
  canManage,
  onCreateLoad,
}: {
  order: PendingOrderRow;
  supplier: string;
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
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-2 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="num font-semibold">Pedido #{o.id}</span>
            <span className={cn("num shrink-0", DAY_TEXT[pendingDay(o.deliveryDate, today)])}>{dayLabel(o.deliveryDate, today)}</span>
          </span>
          <span className="block truncate text-muted-foreground" title={o.clients.join(", ")}>
            {o.clients.join(", ") || "Sin clientes"}
          </span>
          <span className="num flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {formatDecimal(o.bags, 0)} bultos · {tons(o.tons)} t{o.timeWindow ? ` · ${o.timeWindow}` : ""}
            </span>
            {o.otherSuppliers.map((other) => (
              <span key={other} className="rounded-full border px-1.5 py-px text-[11px] font-medium text-foreground">
                + {other}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </button>
      {canManage && (
        <div className="flex shrink-0 items-center pr-3">
          <Button
            variant="outline"
            className="h-11 px-3 md:h-8"
            onClick={() => onCreateLoad(o.id)}
            aria-label={`Crear cargue del pedido #${o.id} (${supplier})`}
          >
            <Plus aria-hidden />
            Cargue
          </Button>
        </div>
      )}
      <SlideOver open={open} onOpenChange={setOpen} title={`Pedido #${o.id}`} description={whenText}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{o.clients.join(", ") || "Sin clientes"}</p>
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
