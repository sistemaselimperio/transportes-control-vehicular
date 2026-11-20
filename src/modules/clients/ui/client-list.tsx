"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { missingLocationCount, type ClientRow } from "../domain/client-row";

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

/** The client's name; a warn-toned count rides on top of it when some fincas lack a location. */
function NameButton({ row, onOpen }: { row: ClientRow; onOpen: (row: ClientRow) => void }) {
  const missing = missingLocationCount(row);
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      title={missing > 0 ? `${missing} ${missing === 1 ? "finca" : "fincas"} sin ubicación` : undefined}
      className="min-w-0 rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      {row.name}
      {missing > 0 && (
        <span className="num ml-1 inline-flex size-[1.125rem] -translate-y-1.5 items-center justify-center rounded-full bg-warn align-top text-[0.625rem] leading-none font-semibold text-warn-foreground no-underline">
          <span aria-hidden>{missing}</span>
          <span className="sr-only">, {missing} sin ubicación</span>
        </span>
      )}
    </button>
  );
}

/**
 * Click anywhere on a row (card or table row) to open the client; clicks on its own buttons keep
 * their action. The name stays a real button, so keyboard and screen reader users open it there.
 */
function openOnRowClick(row: ClientRow, onOpen: (row: ClientRow) => void) {
  return (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    onOpen(row);
  };
}

/** "2 fincas", or just the number (`bare`) in the table, where the "Fincas" header names it. */
function LocationsSummary({ row, bare = false }: { row: ClientRow; bare?: boolean }) {
  const total = row.locations.length;
  if (total === 0) return <>{bare ? "0" : "Sin fincas"}</>;
  return (
    <>
      {bare ? total : `${total} ${total === 1 ? "finca" : "fincas"}`}
    </>
  );
}

/** Clients as a table from `md`, as cards on phones. Without `canManage` the rows carry no edit / delete. */
export function ClientList({
  rows,
  canManage,
  missingOnly,
  onOpen,
  onEdit,
  onDelete,
}: {
  rows: readonly ClientRow[];
  canManage: boolean;
  /** The "fincas sin ubicación" filter is on, so an empty list is explained by it. */
  missingOnly: boolean;
  onOpen: (row: ClientRow) => void;
  onEdit: (row: ClientRow) => void;
  onDelete: (row: ClientRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {missingOnly ? "No hay clientes con fincas sin ubicación para esta búsqueda." : "No hay clientes para esta búsqueda."}
      </p>
    );
  }
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            onClick={openOnRowClick(r, onOpen)}
            className="cursor-pointer space-y-1.5 rounded-2xl border bg-card p-4 transition-colors duration-150 hover:bg-muted/50 active:bg-muted motion-reduce:transition-none"
          >
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
            <p className="num text-xs text-muted-foreground">
              <LocationsSummary row={r} /> · {r.deliveryCount} {r.deliveryCount === 1 ? "entrega" : "entregas"}
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
                {["Cliente", "NIT", "Teléfono", "Fincas", "Entregas"].map((h) => (
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
                <tr
                  key={r.id}
                  onClick={openOnRowClick(r, onOpen)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none"
                >
                  <td className="px-4 py-3">
                    <NameButton row={r} onOpen={onOpen} />
                  </td>
                  <td className="num px-4 py-3 whitespace-nowrap">{r.nit ? formatNit(r.nit) : "—"}</td>
                  <td className="num px-4 py-3 whitespace-nowrap">{r.phone ?? "—"}</td>
                  <td className="num px-4 py-3 whitespace-nowrap">
                    <LocationsSummary row={r} bare />
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
