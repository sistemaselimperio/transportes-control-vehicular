"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderTotals, ordersTotals, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";

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
  return (
    <section aria-labelledby="pending-orders-title" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pending-orders-title" className="text-base font-semibold">
          Pedidos pendientes
        </h2>
        <p className="num text-sm text-muted-foreground">
          {totals.count} {totals.count === 1 ? "pedido" : "pedidos"} · {totals.bags} bultos · {formatDecimal(totals.tons, 3)} t
        </p>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">No hay pedidos pendientes.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => {
            const t = orderTotals(o.lines, kgPerBag);
            return (
              <li key={o.id} className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
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
                <ul className="space-y-0.5 text-sm">
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
                {o.note && <p className="text-xs text-muted-foreground">{o.note}</p>}
                {canManage && (
                  <Button variant="outline" size="sm" className="mt-auto h-10 self-start md:h-8" onClick={() => onCreateLoad(o.id)}>
                    <Plus aria-hidden />
                    Crear cargue
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
