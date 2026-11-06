"use client";

import { Popover } from "@base-ui/react/popover";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { deleteSaleAction } from "../application/sale-actions";
import { formatPrice, type SaleRow } from "../domain/sale-row";

const PLATE_LINK = "plate outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70";

const dateText = (row: SaleRow) => formatDisplayDate(row.date) || "Sin fecha";

function EditButton({ row, onEdit }: { row: SaleRow; onEdit: (row: SaleRow) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 md:size-9"
      aria-label={`Editar venta de ${row.plate}`}
      title="Editar"
      onClick={() => onEdit(row)}
    >
      <Pencil aria-hidden />
    </Button>
  );
}

/** Deletes one sale after confirming in a popover anchored to the button. The vehicle stays sold. */
function DeleteButton({ row, onResult }: { row: SaleRow; onResult: (result: ActionResult) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    // It stays open while the delete runs, so a second click cannot repeat it.
    <Popover.Root open={open} onOpenChange={(next) => (!next && pending ? undefined : setOpen(next))}>
      <Popover.Trigger
        render={<Button variant="ghost" size="icon" className="size-11 hover:text-destructive md:size-9" />}
        aria-label={`Eliminar venta de ${row.plate}`}
        title="Eliminar"
      >
        <Trash2 aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border bg-popover p-4 shadow-soft outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="space-y-1 whitespace-normal">
              <Popover.Title className="text-sm font-semibold">¿Eliminar esta venta?</Popover.Title>
              <Popover.Description className="text-sm break-words">
                {[row.plate, dateText(row), row.buyer].filter(Boolean).join(" · ")}
              </Popover.Description>
              <p className="text-sm text-muted-foreground">
                El vehículo no se elimina y conserva su estado de vendido. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11 px-3 md:h-8" disabled={pending} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 px-3 md:h-8"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteSaleAction(row.id);
                    setOpen(false);
                    onResult(result);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Eliminar
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Sales as a table from `md`, as cards on phones. */
export function SaleList({
  rows,
  empty,
  onEdit,
  onResult,
}: {
  rows: readonly SaleRow[];
  /** Text shown when nothing matches the current filters. */
  empty: string;
  onEdit: (row: SaleRow) => void;
  onResult: (result: ActionResult) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const actions = (r: SaleRow) => (
    <div className="flex items-center whitespace-nowrap">
      <EditButton row={r} onEdit={onEdit} />
      <DeleteButton row={r} onResult={onResult} />
    </div>
  );
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/flota/${encodeURIComponent(r.plate)}`} className={PLATE_LINK}>
                {r.plate}
              </Link>
              <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
                <span className="num text-sm text-muted-foreground">{dateText(r)}</span>
                {actions(r)}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 font-medium">{r.buyer ?? "Sin comprador"}</span>
              <span className="num shrink-0 font-semibold">{r.price === null ? "Sin precio" : formatPrice(r.price)}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {[r.className, r.previousOwner && `Antes: ${r.previousOwner}`].filter(Boolean).join(" · ")}
            </div>
            {r.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{r.notes}</p>}
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} ventas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {["Fecha", "Placa", "Clase", "Comprador", "Precio", "Propietario anterior", "Notas"].map((h) => (
                  <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
                <th scope="col" className="w-px">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="num px-4 py-3 whitespace-nowrap">{dateText(r)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/flota/${encodeURIComponent(r.plate)}`} className={PLATE_LINK}>
                      {r.plate}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.className}</td>
                  <td className="px-4 py-3 font-medium">{r.buyer ?? "—"}</td>
                  <td className="num px-4 py-3 whitespace-nowrap">{r.price === null ? "—" : formatPrice(r.price)}</td>
                  <td className="px-4 py-3">{r.previousOwner ?? "—"}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-muted-foreground" title={r.notes ?? undefined}>
                    {r.notes ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">{actions(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
