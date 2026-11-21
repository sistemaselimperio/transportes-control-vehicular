"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { orderTotals, ordersTotals, productTotals, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";

const STORAGE_KEY = "cargues.pendingOrders.open";
const CHANGE_EVENT = "cargues:pending-orders-open";
const MAX_CHIPS = 3;

/** Storage can be blocked or missing (private windows): every access falls back to "collapsed". */
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// The server does not know the browser's choice: collapsed until hydration.
const readServerOpen = (): boolean => false;

function writeOpen(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Without storage the choice only lasts until reload.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The orders still waiting for a load, so the loader sees what to pick up without opening the form. */
export function PendingOrders({
  orders,
  kgPerBag,
  canManage,
  onCreateLoad,
}: {
  /** Pending orders only. */
  orders: readonly OrderRow[];
  kgPerBag: number;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  const totals = ordersTotals(orders, kgPerBag);
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
    <section aria-labelledby="pending-orders-title" className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-11 w-full cursor-pointer flex-wrap items-center justify-between gap-x-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground md:min-h-9"
      >
        <span className="flex items-center gap-1.5">
          <ChevronDown
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !open && "-rotate-90")}
          />
          <span id="pending-orders-title" className="text-base font-semibold">
            Pedidos pendientes
          </span>
        </span>
        <span className="num text-sm text-muted-foreground">
          {totals.count} {totals.count === 1 ? "pedido" : "pedidos"} · {totals.bags} bultos · {formatDecimal(totals.tons, 3)} t
        </span>
      </button>
      <div id={bodyId} hidden={!open}>
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">No hay pedidos pendientes.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {orders.map((o) => (
              <PendingOrderCard key={o.id} order={o} kgPerBag={kgPerBag} canManage={canManage} onCreateLoad={onCreateLoad} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PendingOrderCard({
  order: o,
  kgPerBag,
  canManage,
  onCreateLoad,
}: {
  order: OrderRow;
  kgPerBag: number;
  canManage: boolean;
  onCreateLoad: (orderId: number) => void;
}) {
  const [detail, setDetail] = useState(false);
  const t = orderTotals(o.lines, kgPerBag);
  const products = productTotals(o.lines);
  const shown = products.slice(0, MAX_CHIPS);
  const more = products.length - shown.length;
  const detailId = `pending-order-${o.id}-detail`;
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">Pedido #{o.id}</p>
          <p className="text-xs text-muted-foreground">
            Entrega {formatDisplayDate(o.deliveryDate)}
            {o.timeWindow && ` · ${o.timeWindow}`}
          </p>
        </div>
        <p className="num shrink-0 text-sm">
          {t.bags} bultos · {formatDecimal(t.tons, 3)} t
        </p>
      </div>
      {products.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Productos del pedido">
          {shown.map((p) => (
            <li key={p.referenceName} className="num rounded-full border bg-muted/50 px-2 py-0.5 text-xs">
              {p.referenceName} <span className="text-muted-foreground">{p.bags}</span>
            </li>
          ))}
          {more > 0 && <li className="rounded-full px-2 py-0.5 text-xs text-muted-foreground">+{more} más</li>}
        </ul>
      )}
      {o.note && <p className="text-xs text-muted-foreground">{o.note}</p>}
      {detail && (
        <ul id={detailId} className="space-y-0.5 text-sm">
          {o.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">
                {l.clientName}
                {l.locationName && <span className="text-muted-foreground"> · {l.locationName}</span>}
                <span className="text-muted-foreground"> · {l.referenceName}</span>
              </span>
              <span className="num shrink-0">{l.bags}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 md:h-8"
          aria-expanded={detail}
          aria-controls={detailId}
          onClick={() => setDetail((v) => !v)}
        >
          {detail ? "Ocultar detalle" : "Ver detalle"}
        </Button>
        {canManage && (
          <Button variant="outline" size="sm" className="h-10 md:h-8" onClick={() => onCreateLoad(o.id)}>
            <Plus aria-hidden />
            Crear cargue
          </Button>
        )}
      </div>
    </li>
  );
}
