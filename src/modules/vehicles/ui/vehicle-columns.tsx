"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import Link from "next/link";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { formatKm, type DocCell, type VehicleGridRow } from "../domain/vehicle-row";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

const SEVERITY = { expired: 4, warning: 3, ok: 2, not_applicable: 1, inactive: 0 } as const;

const pill = (cell: { text: string; status: DocCell["status"] }) => (
  <StatusPill status={cell.status}>{cell.text || "—"}</StatusPill>
);

const dateOrUndefined = (cell: DocCell) => cell.date ?? undefined;

const STICKY =
  "sticky z-10 bg-background group-hover:bg-muted group-focus-within:bg-muted";

export const vehicleColumns: ColumnDef<VehicleGridRow>[] = [
  {
    id: "className",
    header: "Clase",
    accessorFn: (r) => r.className,
    meta: { className: `${STICKY} left-0 w-36 min-w-36 max-w-36` },
    cell: ({ row }) => (
      <div className="leading-tight">
        <div className="font-medium">{row.original.className}</div>
        {row.original.brandLine && (
          <div className="truncate text-xs text-muted-foreground" title={row.original.brandLine}>
            {row.original.brandLine}
          </div>
        )}
      </div>
    ),
  },
  {
    id: "plate",
    header: "Placa",
    accessorFn: (r) => r.plate,
    meta: { className: `${STICKY} left-36 w-24 min-w-24 border-r` },
    cell: ({ row }) => (
      <Link
        href={`/vehiculos/${encodeURIComponent(row.original.plate)}`}
        className="font-mono font-semibold underline-offset-2 hover:underline focus-visible:underline"
      >
        {row.original.plate}
      </Link>
    ),
  },
  {
    id: "owner",
    header: "Propietario",
    accessorFn: (r) => r.ownerName ?? "",
    cell: ({ row }) =>
      row.original.ownerName ?? <span className="text-muted-foreground">Sin propietario</span>,
  },
  {
    id: "policy",
    header: "Póliza",
    accessorFn: (r) => dateOrUndefined(r.policy),
    sortUndefined: "last",
    cell: ({ row }) => pill(row.original.policy),
  },
  { id: "municipality", header: "Municipio", accessorFn: (r) => r.municipality ?? "" },
  { id: "service", header: "Servicio", accessorFn: (r) => r.serviceLabel },
  {
    id: "tax",
    header: "Impuesto",
    accessorFn: (r) => r.tax.text,
    cell: ({ row }) => pill(row.original.tax),
  },
  {
    id: "driver",
    header: "Conductor",
    accessorFn: (r) => r.driverName ?? "",
    cell: ({ row }) => row.original.driverName ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "phone",
    header: "Celular",
    accessorFn: (r) => r.driverPhone ?? "",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.driverPhone ? (
        <a
          href={`tel:${row.original.driverPhone}`}
          className="tabular-nums underline-offset-2 hover:underline"
        >
          {row.original.driverPhone}
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "lastOil",
    header: "F. cambio",
    accessorFn: (r) => r.lastOilDate ?? undefined,
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.lastOilDate ? (
        <span className="tabular-nums">{formatDisplayDate(row.original.lastOilDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "km",
    header: "Kilometraje",
    accessorFn: (r) => r.km ?? undefined,
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.km != null ? (
        <span className="tabular-nums">{formatKm(row.original.km)}</span>
      ) : row.original.odometerWorking ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="text-muted-foreground">No sirve</span>
      ),
  },
  {
    id: "nextChange",
    header: "Próx. cambio",
    accessorFn: (r) => SEVERITY[r.nextChange.status],
    sortDescFirst: true,
    cell: ({ row }) => pill(row.original.nextChange),
  },
  {
    id: "soat",
    header: "SOAT",
    accessorFn: (r) => dateOrUndefined(r.soat),
    sortUndefined: "last",
    cell: ({ row }) => pill(row.original.soat),
  },
  {
    id: "tecno",
    header: "Tecno",
    accessorFn: (r) => dateOrUndefined(r.tecno),
    sortUndefined: "last",
    cell: ({ row }) => pill(row.original.tecno),
  },
  {
    id: "status",
    header: "Estado",
    accessorFn: (r) => SEVERITY[r.overall],
    sortDescFirst: true,
    cell: ({ row }) => (
      <StatusPill status={row.original.overall}>{row.original.statusLabel}</StatusPill>
    ),
  },
];
