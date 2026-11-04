"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatTripDateTime } from "../domain/trip-datetime";
import type { TripRow } from "../domain/trip-row";
import { TripStatusBadge } from "./trip-status-badge";

/** The plate links to the vehicle's file while the vehicle still exists. */
function Plate({ row }: { row: TripRow }) {
  if (row.vehicleId === null) return <span className="plate">{row.plate}</span>;
  return (
    <Link
      href={`/flota/${encodeURIComponent(row.plate)}`}
      className="plate outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      {row.plate}
    </Link>
  );
}

function EditButton({ row, onEdit }: { row: TripRow; onEdit: (row: TripRow) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 md:size-9"
      aria-label={`Editar viaje a ${row.destination}`}
      title="Editar"
      onClick={() => onEdit(row)}
    >
      <Pencil aria-hidden />
    </Button>
  );
}

function DeleteButton({ row, onDelete }: { row: TripRow; onDelete: (row: TripRow) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 text-destructive md:size-9"
      aria-label={`Eliminar viaje a ${row.destination}`}
      title="Eliminar"
      onClick={() => onDelete(row)}
    >
      <Trash2 aria-hidden />
    </Button>
  );
}

/** Trips as a table from `md`, as cards on phones. Without `canManage` the rows carry no edit / delete. */
export function TripList({
  rows,
  canManage,
  onEdit,
  onDelete,
}: {
  rows: readonly TripRow[];
  canManage: boolean;
  onEdit: (row: TripRow) => void;
  onDelete: (row: TripRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay viajes para este filtro.</p>;
  }
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-medium">{r.destination}</span>
              {canManage && (
                <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
                  <EditButton row={r} onEdit={onEdit} />
                  <DeleteButton row={r} onDelete={onDelete} />
                </div>
              )}
            </div>
            <div className="num text-sm text-muted-foreground">{formatTripDateTime(r.startAt)}</div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <Plate row={r} />
              <span className="text-sm text-muted-foreground">{r.area}</span>
              <span className="ml-auto">
                <TripStatusBadge status={r.status} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} viajes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {["Fecha inicio", "Destino", "Placa", "Área", "Estado"].map((h) => (
                  <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
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
                  <td className="num px-4 py-3 whitespace-nowrap">{formatTripDateTime(r.startAt)}</td>
                  <td className="px-4 py-3 font-medium">{r.destination}</td>
                  <td className="px-4 py-3">
                    <Plate row={r} />
                  </td>
                  <td className="px-4 py-3">{r.area}</td>
                  <td className="px-4 py-3">
                    <TripStatusBadge status={r.status} />
                  </td>
                  {canManage && (
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <EditButton row={r} onEdit={onEdit} />
                      <DeleteButton row={r} onDelete={onDelete} />
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
