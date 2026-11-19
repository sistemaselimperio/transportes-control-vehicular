"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import type { ClientRow } from "../domain/client-row";

function RowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: ClientRow;
  onEdit: (row: ClientRow) => void;
  onDelete: (row: ClientRow) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:size-9"
        aria-label={`Editar ${row.name}`}
        title="Editar"
        onClick={() => onEdit(row)}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-destructive md:size-9"
        aria-label={`Eliminar ${row.name}`}
        title="Eliminar"
        onClick={() => onDelete(row)}
      >
        <Trash2 aria-hidden />
      </Button>
    </>
  );
}

function NameButton({ row, onOpen }: { row: ClientRow; onOpen: (row: ClientRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="min-w-0 rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      {row.name}
    </button>
  );
}

/** Clients as a table from `md`, as cards on phones. Without `canManage` the rows carry no edit / delete. */
export function ClientList({
  rows,
  canManage,
  onOpen,
  onEdit,
  onDelete,
}: {
  rows: readonly ClientRow[];
  canManage: boolean;
  onOpen: (row: ClientRow) => void;
  onEdit: (row: ClientRow) => void;
  onDelete: (row: ClientRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay clientes para esta búsqueda.</p>;
  }
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-1.5 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <NameButton row={r} onOpen={onOpen} />
              {canManage && (
                <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
                  <RowActions row={r} onEdit={onEdit} onDelete={onDelete} />
                </div>
              )}
            </div>
            {r.nit && <p className="num text-sm text-muted-foreground">NIT {formatNit(r.nit)}</p>}
            {r.phone && <p className="num text-sm text-muted-foreground">{r.phone}</p>}
            {r.address && <p className="text-sm text-muted-foreground">{r.address}</p>}
            <p className="num text-xs text-muted-foreground">
              {r.deliveryCount} {r.deliveryCount === 1 ? "entrega" : "entregas"}
            </p>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {["Cliente", "NIT", "Teléfono", "Dirección", "Entregas"].map((h) => (
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
                  <td className="px-4 py-3">
                    <NameButton row={r} onOpen={onOpen} />
                  </td>
                  <td className="num px-4 py-3 whitespace-nowrap">{r.nit ? formatNit(r.nit) : "—"}</td>
                  <td className="num px-4 py-3 whitespace-nowrap">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="block max-w-64 truncate" title={r.address ?? undefined}>
                      {r.address ?? "—"}
                    </span>
                  </td>
                  <td className="num px-4 py-3">{r.deliveryCount}</td>
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
