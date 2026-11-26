import { CalendarDays, MapPin, PackageCheck, PackageOpen, StickyNote } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { remainingBags, type BalanceTripRow, type LoadBalanceRow } from "../domain/load-balance";
import { freeLoadRows, groupLinesByOrder, isFreeLoad } from "../domain/load-lines";
import { formatCop, type LoadOrderBlock, type LoadRow } from "../domain/load-rules";
import { BalanceTrips } from "./balance-trips";

const bagsText = (bags: number) => `${formatDecimal(bags, 0)} ${bags === 1 ? "bulto" : "bultos"}`;

/** A labelled value of an order's numbers. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="micro-label text-muted-foreground">{label}</dt>
      <dd className="num truncate text-sm font-medium">{children}</dd>
    </div>
  );
}

/** The bags a truck left behind of one order: what is still to carry and the trips made. */
function BalanceBox({ balance: b, onDeleteTrip }: { balance: LoadBalanceRow; onDeleteTrip?: (trip: BalanceTripRow) => void }) {
  const left = remainingBags(b);
  const carried = b.bags - left;
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", left > 0 ? "border-warn/40 bg-warn/10" : "bg-muted/40")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <PackageOpen aria-hidden className="size-4" />
          Carga incompleta
        </p>
        <p className={cn("num text-sm font-semibold", left > 0 && "text-warn-foreground")}>
          {left > 0 ? `Faltan ${bagsText(left)}` : "Saldo completo"}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background" role="presentation">
        <div className="h-full rounded-full bg-ok" style={{ width: `${b.bags > 0 ? (carried / b.bags) * 100 : 100}%` }} />
      </div>
      <p className="num text-xs text-muted-foreground">
        {formatDecimal(carried, 0)} de {bagsText(b.bags)} llevados
        {left > 0 && ` · ${formatDisplayDate(b.scheduledDate)} · ${b.plate ?? "sin placa"}`}
      </p>
      {b.trips.length > 0 && <BalanceTrips trips={b.trips} onDelete={onDeleteTrip} />}
    </div>
  );
}

/** One order of the load: who it goes to, its supplier numbers and cost, the products carried and its balance. */
function OrderCard({
  order,
  group,
  balance,
  onDeleteTrip,
}: {
  order: LoadOrderBlock;
  group: ReturnType<typeof groupLinesByOrder>[number] | undefined;
  balance: LoadBalanceRow | undefined;
  onDeleteTrip?: (trip: BalanceTripRow) => void;
}) {
  return (
    <section aria-label={`Pedido #${order.id}`} className="overflow-hidden rounded-xl border">
      <header className="space-y-1 border-b bg-muted/50 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="num font-semibold">Pedido #{order.id}</h3>
          <span className="num text-sm text-muted-foreground">{bagsText(order.bags)}</span>
        </div>
        <ul className="space-y-0.5 text-sm">
          {order.clients.length === 0 ? (
            <li className="text-muted-foreground">Sin clientes</li>
          ) : (
            order.clients.map((c) => (
              <li key={`${c.clientName}-${c.locationName ?? ""}`} className="flex items-start gap-1.5">
                <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="font-medium">{c.locationName ?? "Sin finca"}</span>
                  <span className="text-muted-foreground"> · {c.clientName}</span>
                </span>
              </li>
            ))
          )}
        </ul>
        <p className="num flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays aria-hidden className="size-3.5" />
          Entrega {formatDisplayDate(order.deliveryDate)}
          {order.timeWindow ? ` · ${order.timeWindow}` : ""}
        </p>
        {order.deliveredAt && (
          <p className="num inline-flex items-center gap-1.5 rounded-full bg-ok px-2.5 py-0.5 text-xs font-medium text-ok-foreground">
            <PackageCheck aria-hidden className="size-3.5" />
            Entregado · {formatDisplayDate(order.deliveredAt)}
          </p>
        )}
      </header>

      <div className="space-y-3 px-4 py-3">
        {group && (
          <dl className="grid grid-cols-3 gap-3">
            <Field label="SIESA">{group.siesaNumbers.join(", ")}</Field>
            <Field label="Pedido prov.">{group.orderNumbers.join(", ")}</Field>
            <Field label="Costo">{formatCop(group.cost)}</Field>
          </dl>
        )}

        <ul className="divide-y rounded-lg border text-sm">
          {order.products.map((p) => (
            <li key={p.referenceId} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0">{p.label}</span>
              <span className="num shrink-0 text-right">
                <span className="font-semibold">{formatDecimal(p.bags, 0)}</span>
                <span className="text-muted-foreground"> bultos · {formatDecimal(p.tons, 3)} t</span>
              </span>
            </li>
          ))}
        </ul>

        {balance && <BalanceBox balance={balance} onDeleteTrip={onDeleteTrip} />}
      </div>
    </section>
  );
}

/** The SIESA rows of a load without an order, as a table. */
function FreeTable({ row }: { row: LoadRow }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {["SIESA", "Pedido", "Peso (kg)", "Valor"].map((h, i) => (
              <th key={h} scope="col" className={cn("micro-label px-3 py-2 font-medium", i < 2 ? "text-left" : "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {freeLoadRows(row.lines).map((r) => (
            <tr key={`${r.siesaNumber}-${r.orderNumber}`}>
              <td className="num px-3 py-2 font-medium">{r.siesaNumber}</td>
              <td className="num px-3 py-2">{r.orderNumber}</td>
              <td className="num px-3 py-2 text-right">{formatDecimal(r.kg, 0)}</td>
              <td className="num px-3 py-2 text-right">{formatCop(r.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Everything about one load, for its side sheet: each order (or the SIESA rows of a free load), then the notes. */
export function LoadDetail({
  row,
  balances,
  onDeleteTrip,
}: {
  row: LoadRow;
  /** The balances this load left behind. */
  balances: readonly LoadBalanceRow[];
  onDeleteTrip?: (trip: BalanceTripRow) => void;
}) {
  const free = isFreeLoad(row.lines);
  const groups = new Map(groupLinesByOrder(row.lines).map((g) => [g.orderId, g]));

  return (
    <div className="space-y-5">
      {free ? (
        <FreeTable row={row} />
      ) : row.orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin pedidos.</p>
      ) : (
        <div className="space-y-3">
          {row.orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              group={groups.get(o.id)}
              balance={balances.find((b) => b.orderId === o.id)}
              onDeleteTrip={onDeleteTrip}
            />
          ))}
        </div>
      )}

      {row.notes && (
        <section aria-label="Notas" className="flex gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <StickyNote aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-line">{row.notes}</p>
        </section>
      )}
    </div>
  );
}
