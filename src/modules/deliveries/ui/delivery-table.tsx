"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatBags, formatKg, formatTons } from "../domain/delivery-format";
import type { DeliveryRow } from "../domain/delivery-rules";
import { DeliveryPriorityBadge, DeliveryStatusBadge } from "./delivery-badges";

function Plate({ row }: { row: DeliveryRow }) {
  if (!row.plate) return <span className="text-muted-foreground">—</span>;
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

function RowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: DeliveryRow;
  onEdit: (row: DeliveryRow) => void;
  onDelete: (row: DeliveryRow) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:size-9"
        aria-label={`Editar entrega de ${row.clientName}`}
        title="Editar"
        onClick={() => onEdit(row)}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-destructive md:size-9"
        aria-label={`Eliminar entrega de ${row.clientName}`}
        title="Eliminar"
        onClick={() => onDelete(row)}
      >
        <Trash2 aria-hidden />
      </Button>
    </>
  );
}

const HEADERS = ["Fecha", "Turno", "Cliente", "Destino", "Bultos", "Kg", "Ton", "Estado", "Placa"] as const;
const NUMERIC = new Set<string>(["Bultos", "Kg", "Ton"]);

/** Deliveries as a table from `md`, as cards on phones. Without `canManage` the rows carry no edit / delete. */
export function DeliveryTable({
  rows,
  canManage,
  onEdit,
  onDelete,
  emptyMessage,
}: {
  rows: readonly DeliveryRow[];
  canManage: boolean;
  onEdit: (row: DeliveryRow) => void;
  onDelete: (row: DeliveryRow) => void;
  emptyMessage: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            className={cn("space-y-2 rounded-2xl border bg-card p-4", r.priority === "urgente" && "border-destructive/40")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{r.clientName}</p>
                {r.locationName && <p className="text-sm text-muted-foreground">Finca {r.locationName}</p>}
                <p className="text-sm text-muted-foreground">
                  {r.destination} · {r.shift}
                </p>
              </div>
              {canManage && (
                <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
                  <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />
                </div>
              )}
            </div>
            <p className="num text-sm text-muted-foreground">
              {formatDisplayDate(r.date)} · {formatBags(r.quantity)} bultos · {formatKg(r.weightKg)} kg · {formatTons(r.weightKg)} t
            </p>
            {r.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{r.notes}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <Plate row={r} />
              <DeliveryPriorityBadge priority={r.priority} />
              <span className="ml-auto">
                <DeliveryStatusBadge status={r.status} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} entregas</span>
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
                <tr key={r.id} className={cn("hover:bg-muted/50", r.priority === "urgente" && "bg-destructive-faint")}>
                  <td className="num px-4 py-3 whitespace-nowrap">{formatDisplayDate(r.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.shift}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.clientName}</span>
                    {r.locationName && <span className="block text-xs text-muted-foreground">Finca {r.locationName}</span>}
                    {r.clientNit && <span className="num block text-xs text-muted-foreground">{formatNit(r.clientNit)}</span>}
                    {r.notes && (
                      <span className="block max-w-64 truncate text-xs text-muted-foreground" title={r.notes}>
                        {r.notes}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.destination}</td>
                  <td className="num px-4 py-3 text-right">{formatBags(r.quantity)}</td>
                  <td className="num px-4 py-3 text-right">{formatKg(r.weightKg)}</td>
                  <td className="num px-4 py-3 text-right">{formatTons(r.weightKg)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <DeliveryStatusBadge status={r.status} />
                      <DeliveryPriorityBadge priority={r.priority} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Plate row={r} />
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
