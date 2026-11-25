"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { productLabel } from "@/modules/orders/domain/catalog";
import { orderLoadIds, orderTotals, ordersTotals, productTotals, remainingLines, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatShortDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { bucketPendingOrders, clientNames, daysLate, PENDING_DAYS, pendingDay, type PendingDay } from "@/modules/orders/domain/order-days";

const STORAGE_KEY = "cargues.pendingOrders.open";
const CHANGE_EVENT = "cargues:pending-orders-open";

const tons = (value: number) => formatDecimal(value, 3);

/** Storage can be blocked or missing (private windows): every access falls back to "open". */
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Open unless the loader closed it: what is left to load is the first thing to see. */
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

const readServerOpen = (): boolean => true;

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Without storage the choice only lasts until reload.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Only a late or a today order carries colour: a dot, and the same hue on its day. */
const DOT: Record<PendingDay, string> = {
  atrasado: "bg-destructive",
  hoy: "bg-amber-500",
  manana: "bg-transparent",
  despues: "bg-transparent",
};
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
 * The orders still waiting for a load, one compact line each in delivery order (late first): a status
 * dot, the number, the day and window, the clients, the bags and "Cargue". A partially loaded order stays
 * here with only what is still to load. A line opens its detail.
 */
export function PendingOrders({
  orders,
  today,
  kgPerBag,
  canManage,
  onCreateLoad,
}: {
  /** Pending orders, including the partially loaded ones. */
  orders: readonly OrderRow[];
  /** Colombia's current day. */
  today: string;
  kgPerBag: number;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  // A partially loaded order counts only for what is still to load.
  const totals = ordersTotals(
    orders.map((o) => ({ lines: remainingLines(o) })),
    kgPerBag,
  );
  const buckets = bucketPendingOrders(orders, today);
  const sorted = PENDING_DAYS.flatMap((d) => buckets[d]);
  const storedOpen = useSyncExternalStore(subscribe, readOpen, readServerOpen);
  // Where storage is unavailable the toggle still works for this visit.
  const [sessionOpen, setSessionOpen] = useState<boolean | null>(null);
  const open = sessionOpen ?? storedOpen;
  const bodyId = "pending-orders-body";

  function toggle() {
    const next = !open;
    setSessionOpen(next);
    writeOpen(next);
  }

  return (
    <section aria-labelledby="pending-orders-title" className="panel">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
          open && "border-b",
        )}
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")}
          />
          <h2 id="pending-orders-title" className="text-base font-semibold">
            Pedidos pendientes
          </h2>
          <span className="num text-base font-semibold text-muted-foreground">{totals.count}</span>
        </span>
        <span className="num text-sm text-muted-foreground">
          {totals.bags} bultos · {tons(totals.tons)} t
        </span>
      </button>

      <div id={bodyId} hidden={!open}>
        {orders.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay pedidos pendientes: todo lo pedido ya tiene cargue.</p>
        ) : (
          <>
            <ul className="divide-y">
              {sorted.map((o) => (
                <OrderLine key={o.id} order={o} today={today} kgPerBag={kgPerBag} canManage={canManage} onCreateLoad={onCreateLoad} />
              ))}
            </ul>
            {(buckets.atrasado.length > 0 || buckets.hoy.length > 0) && (
              <p className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-destructive" />
                  Atrasado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-amber-500" />
                  Para hoy
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** One order on one line; the line itself opens its products in a modal. */
function OrderLine({
  order: o,
  today,
  kgPerBag,
  canManage,
  onCreateLoad,
}: {
  order: OrderRow;
  today: string;
  kgPerBag: number;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  const [detail, setDetail] = useState(false);
  const t = orderTotals(remainingLines(o), kgPerBag);
  const names = clientNames(o);
  const loadedIds = orderLoadIds(o).map((id) => `#${id}`).join(", ");
  const partialText = o.partial ? `Cargado parcial ${loadedIds} · falta ${o.pendingSuppliers.join(" y ")}` : null;
  const when = pendingDay(o.deliveryDate, today);
  const whenText = [dayLabel(o.deliveryDate, today), o.timeWindow].filter(Boolean).join(" · ");

  return (
    <li>
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setDetail(true)}
          className="grid min-h-14 min-w-0 flex-1 cursor-pointer grid-cols-[0.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 pl-4 text-left text-sm transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground md:grid-cols-[0.5rem_3.5rem_10rem_minmax(0,1fr)_4.5rem] md:py-0"
        >
          {/* The dot keeps its slot even when transparent, so every number starts on one edge. */}
          <span aria-hidden className={cn("size-2 rounded-full max-md:row-span-2", DOT[when])} />
          <span className="flex min-w-0 items-baseline gap-2 md:contents">
            <span className="num font-semibold">#{o.id}</span>
            <span className="min-w-0 truncate">
              <span className={DAY_TEXT[when]}>{dayLabel(o.deliveryDate, today)}</span>
              {o.timeWindow && <span className="text-muted-foreground"> · {o.timeWindow}</span>}
            </span>
          </span>
          <span className="num text-right font-semibold md:order-last">
            {t.bags}
            <span className="font-normal text-muted-foreground md:sr-only"> bultos</span>
          </span>
          <span
            className="col-start-2 min-w-0 truncate text-muted-foreground md:col-start-auto md:text-foreground"
            title={[names.join(", "), partialText].filter(Boolean).join(" · ")}
          >
            {names.join(", ") || "Sin clientes"}
            {partialText && <span className="num text-xs text-warn-foreground"> · {partialText}</span>}
          </span>
        </button>
        {canManage && (
          <Button
            variant="outline"
            className="h-11 shrink-0 px-3 md:h-8"
            onClick={() => onCreateLoad(o.id)}
            aria-label={`Crear cargue con el pedido ${o.id}`}
          >
            <Plus aria-hidden />
            Cargue
          </Button>
        )}
      </div>

      <SlideOver
        open={detail}
        onOpenChange={setDetail}
        title={`Pedido #${o.id}`}
        description={`${whenText} · ${t.bags} bultos · ${tons(t.tons)} t`}
      >
        <OrderDetail order={o} partialText={partialText} />
      </SlideOver>
    </li>
  );
}

/** What is still to load of the order: one line per product with its bags summed across the clients. */
function OrderDetail({ order: o, partialText }: { order: OrderRow; partialText: string | null }) {
  const products = productTotals(remainingLines(o));
  return (
    <div className="space-y-4">
      {partialText && <p className="num text-sm text-warn-foreground">{partialText}</p>}
      <ul className="divide-y text-sm">
        {products.map((p) => (
          <li key={p.referenceId} className="flex items-baseline justify-between gap-3 py-2">
            <span className="min-w-0">{productLabel({ code: p.referenceCode, name: p.referenceName })}</span>
            <span className="num shrink-0 font-semibold">{p.bags}</span>
          </li>
        ))}
      </ul>
      {o.note && <p className="text-sm text-warn-foreground">{o.note}</p>}
    </div>
  );
}
