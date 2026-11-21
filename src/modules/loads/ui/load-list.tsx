"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { formatCop, summarizeLinkedOrders, type LoadRow } from "../domain/load-rules";

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

/** "#3, #5 · 75 bultos"; opening it lists the clients and fincas of every order. */
function LinkedOrders({ orders }: { orders: LoadRow["orders"] }) {
  if (orders.length === 0) return <span className="text-muted-foreground">—</span>;
  const { label, bags } = summarizeLinkedOrders(orders);
  return (
    <details className="group">
      <summary className="num cursor-pointer rounded-sm outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/70">
        {label} · {formatDecimal(bags, 0)} bultos
      </summary>
      <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
        {orders.map((o) => (
          <li key={o.id}>
            <span className="num font-medium text-foreground">#{o.id}</span>{" "}
            {o.lines.map((l) => (l.locationName ? `${l.clientName} (${l.locationName})` : l.clientName)).join(", ")}
          </li>
        ))}
      </ul>
    </details>
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
        aria-label={`Editar cargue ${row.siesaNumber}`}
        title="Editar"
        onClick={() => onEdit(row)}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-destructive md:size-9"
        aria-label={`Eliminar cargue ${row.siesaNumber}`}
        title="Eliminar"
        onClick={() => onDelete(row)}
      >
        <Trash2 aria-hidden />
      </Button>
    </>
  );
}

const HEADERS = ["Fecha", "Proveedor", "Placa", "Toneladas", "Costo", "SIESA", "Pedido proveedor", "Pedidos"] as const;
const NUMERIC = new Set<string>(["Toneladas", "Costo"]);

/** Loads as a table from `md`, as cards on phones. Without `canManage` the rows carry no edit / delete. */
export function LoadList({
  rows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: readonly LoadRow[];
  canManage: boolean;
  onEdit: (row: LoadRow) => void;
  onDelete: (row: LoadRow) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No hay cargues para este filtro.</p>;
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{r.supplier}</p>
                <p className="num text-sm text-muted-foreground">{formatDisplayDate(r.date)}</p>
              </div>
              {canManage && (
                <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
                  <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />
                </div>
              )}
            </div>
            <p className="num text-sm">
              {formatDecimal(r.tons, 3)} t · {formatCop(r.cost)}
            </p>
            <p className="num text-sm text-muted-foreground">
              SIESA {r.siesaNumber} · Pedido proveedor {r.orderNumber}
            </p>
            {r.orders.length > 0 && (
              <div className="text-sm">
                <LinkedOrders orders={r.orders} />
              </div>
            )}
            {r.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{r.notes}</p>}
            <div className="border-t pt-2">
              <Plate row={r} />
            </div>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} cargues</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {HEADERS.map((h) => (
                  <th key={h} scope="col" className={cn("micro-label px-4 py-3 font-medium", NUMERIC.has(h) && "text-right")}>
                    {h}
                  </th>
                ))}
                {canManage && (
                  <th scope="col" className="w-24">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="num px-4 py-3 whitespace-nowrap">{formatDisplayDate(r.date)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.supplier}</span>
                    {r.notes && (
                      <span className="block max-w-64 truncate text-xs text-muted-foreground" title={r.notes}>
                        {r.notes}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Plate row={r} />
                  </td>
                  <td className="num px-4 py-3 text-right">{formatDecimal(r.tons, 3)}</td>
                  <td className="num px-4 py-3 text-right whitespace-nowrap">{formatCop(r.cost)}</td>
                  <td className="num px-4 py-3">{r.siesaNumber}</td>
                  <td className="num px-4 py-3">{r.orderNumber}</td>
                  <td className="px-4 py-3 align-top">
                    <LinkedOrders orders={r.orders} />
                  </td>
                  {canManage && (
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
