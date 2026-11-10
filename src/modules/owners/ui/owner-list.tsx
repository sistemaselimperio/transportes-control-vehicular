"use client";

import { Popover } from "@base-ui/react/popover";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { deleteOwnerAction } from "../application/owner-actions";
import type { OwnerRow } from "../domain/owner-row";

function Plates({ plates }: { plates: readonly string[] }) {
  if (plates.length === 0) return <span className="text-sm text-muted-foreground">Sin vehículos</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {plates.map((p) => (
        <Link
          key={p}
          href={`/flota/${encodeURIComponent(p)}`}
          className="plate outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <PlateText plate={p} />
        </Link>
      ))}
    </span>
  );
}

function EditButton({ row, onEdit }: { row: OwnerRow; onEdit: (row: OwnerRow) => void }) {
  return (
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
  );
}

/**
 * Deletes one owner after confirming in a popover anchored to the button. Their vehicles stay,
 * without that owner; the popover says which ones.
 */
function DeleteButton({ row, onResult }: { row: OwnerRow; onResult: (result: ActionResult) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const count = row.plates.length;

  return (
    // It stays open while the delete runs, so a second click cannot repeat it.
    <Popover.Root open={open} onOpenChange={(next) => (!next && pending ? undefined : setOpen(next))}>
      <Popover.Trigger
        render={<Button variant="ghost" size="icon" className="size-11 hover:text-destructive md:size-9" />}
        aria-label={`Eliminar ${row.name}`}
        title="Eliminar"
      >
        <Trash2 aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border bg-popover p-4 shadow-soft outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="space-y-1 whitespace-normal">
              <Popover.Title className="text-sm font-semibold">¿Eliminar este propietario?</Popover.Title>
              <Popover.Description className="text-sm break-words">{row.name}</Popover.Description>
              <p className="text-sm text-muted-foreground">
                {count === 0
                  ? "No tiene vehículos."
                  : `${count === 1 ? "Su vehículo" : `Sus ${count} vehículos`} (${row.plates.join(", ")}) ${count === 1 ? "queda" : "quedan"} sin propietario; no se elimina${count === 1 ? "" : "n"}.`}{" "}
                Esta acción no se puede deshacer.
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
                    const result = await deleteOwnerAction(row.id);
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

/** Owners as a table from `md`, as cards on phones. Without `canManage` the rows carry no edit / delete. */
export function OwnerList({
  rows,
  canManage,
  empty,
  onEdit,
  onResult,
}: {
  rows: readonly OwnerRow[];
  canManage: boolean;
  /** Text shown when nothing matches the current filters. */
  empty: string;
  onEdit: (row: OwnerRow) => void;
  onResult: (result: ActionResult) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const actions = (r: OwnerRow) => (
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
              <span className="min-w-0 font-medium">{r.name}</span>
              {canManage && <div className="-mt-2 -mr-2 shrink-0">{actions(r)}</div>}
            </div>
            <div className="text-sm text-muted-foreground">
              {[GROUP_LABELS[r.group], r.documentNumber && `NIT/C.C. ${r.documentNumber}`].filter(Boolean).join(" · ")}
            </div>
            <div className="border-t pt-2">
              <Plates plates={r.plates} />
            </div>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} propietarios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {["Propietario", "Documento", "Grupo", "Vehículos"].map((h) => (
                  <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
                {canManage && (
                  <th scope="col" className="w-px">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="num px-4 py-3">{r.documentNumber ?? "—"}</td>
                  <td className="px-4 py-3">{GROUP_LABELS[r.group]}</td>
                  <td className="px-4 py-3">
                    <Plates plates={r.plates} />
                  </td>
                  {canManage && <td className="px-2 py-1.5 text-right">{actions(r)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
