"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AlertStatus } from "@/modules/alerts/domain/alert-status";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import {
  COMPANY_LABELS,
  DRIVER_STATUS_LABELS,
  type DriverRow,
  type DriverStatus,
} from "../domain/driver-row";

const STATUS_TONE: Record<DriverStatus, AlertStatus> = {
  ACTIVE: "ok",
  IN_WORKSHOP: "warning",
  INACTIVE: "inactive",
};

function Plates({ plates }: { plates: readonly string[] }) {
  if (plates.length === 0) return <span className="text-sm text-muted-foreground">Sin vehículo</span>;
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

const Status = ({ status }: { status: DriverStatus }) => (
  <StatusPill status={STATUS_TONE[status]}>{DRIVER_STATUS_LABELS[status]}</StatusPill>
);

function EditButton({ row, onEdit }: { row: DriverRow; onEdit: (row: DriverRow) => void }) {
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

/** Drivers as a table from `md`, as cards on phones. Without `onEdit` the list is read-only. */
export function DriverList({
  rows,
  onEdit,
}: {
  rows: readonly DriverRow[];
  onEdit?: (row: DriverRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay conductores para este filtro.</p>;
  }
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-medium">{r.name}</span>
              <div className="-mt-2 -mr-2 flex shrink-0 items-center gap-1">
                <Status status={r.status} />
                {onEdit && <EditButton row={r} onEdit={onEdit} />}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {[r.company && COMPANY_LABELS[r.company], r.nationalId && `C.C. ${r.nationalId}`]
                .filter(Boolean)
                .join(" · ") || "Sin datos"}
            </div>
            {r.phone && (
              <a href={`tel:+57${r.phone}`} className="num block text-sm underline-offset-2 hover:underline">
                {r.phone}
              </a>
            )}
            <div className="border-t pt-2">
              <Plates plates={r.plates} />
            </div>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{rows.length} conductores</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {["Conductor", "Cédula", "Empresa", "Estado", "Teléfono", "Vehículos"].map((h) => (
                  <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
                {onEdit && (
                  <th scope="col" className="w-12">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="num px-4 py-3">{r.nationalId ?? "—"}</td>
                  <td className="px-4 py-3">{r.company ? COMPANY_LABELS[r.company] : "—"}</td>
                  <td className="px-4 py-3">
                    <Status status={r.status} />
                  </td>
                  <td className="num px-4 py-3">
                    {r.phone ? (
                      <a href={`tel:+57${r.phone}`} className="underline-offset-2 hover:underline">
                        {r.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Plates plates={r.plates} />
                  </td>
                  {onEdit && (
                    <td className="px-2 py-1.5 text-right">
                      <EditButton row={r} onEdit={onEdit} />
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
