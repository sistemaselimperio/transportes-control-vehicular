"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
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
          {p}
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

/** Owners as a table from `md`, as cards on phones. */
export function OwnerList({
  rows,
  empty,
  onEdit,
}: {
  rows: readonly OwnerRow[];
  /** Text shown when nothing matches the current filters. */
  empty: string;
  onEdit: (row: OwnerRow) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-medium">{r.name}</span>
              <div className="-mt-2 -mr-2 shrink-0">
                <EditButton row={r} onEdit={onEdit} />
              </div>
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
                <th scope="col" className="w-12">
                  <span className="sr-only">Acciones</span>
                </th>
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
                  <td className="px-2 py-1.5 text-right">
                    <EditButton row={r} onEdit={onEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
