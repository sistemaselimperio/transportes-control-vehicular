"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import Link from "next/link";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { COLUMN_GROUPS, type ColumnGroupKey } from "../domain/column-groups";
import { formatKm, type DocCell, type VehicleGridRow } from "../domain/vehicle-row";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    align?: "right";
    groupKey?: ColumnGroupKey;
  }
}

const SEVERITY = { expired: 4, warning: 3, ok: 2, not_applicable: 1, inactive: 0 } as const;

const pill = (cell: { text: string; status: DocCell["status"] }) => (
  <StatusPill status={cell.status}>{cell.text || "—"}</StatusPill>
);

const dateOrUndefined = (cell: DocCell) => cell.date ?? undefined;

const dash = <span className="text-muted-foreground">—</span>;

const STICKY = "sticky z-10 bg-card group-hover:bg-muted group-focus-within:bg-muted";

const leaves: Record<string, ColumnDef<VehicleGridRow>> = {
  className: {
    id: "className",
    header: "Clase",
    accessorFn: (r) => r.className,
    meta: { className: `${STICKY} left-0 w-40 min-w-40 max-w-40` },
    cell: ({ row }) => (
      <div className="leading-tight">
        <div className="font-medium">{row.original.className}</div>
        {row.original.brandLine && (
          <div className="truncate text-[0.6875rem] text-muted-foreground" title={row.original.brandLine}>
            {row.original.brandLine}
          </div>
        )}
      </div>
    ),
  },
  plate: {
    id: "plate",
    header: "Placa",
    accessorFn: (r) => r.plate,
    meta: { className: `${STICKY} left-40 w-32 min-w-32 border-r` },
    cell: ({ row }) => (
      <Link
        href={`/flota/${encodeURIComponent(row.original.plate)}`}
        className="inline-flex rounded-[5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      >
        <span className="plate">{row.original.plate}</span>
      </Link>
    ),
  },
  municipality: { id: "municipality", header: "Municipio", accessorFn: (r) => r.municipality ?? "" },
  service: { id: "service", header: "Servicio", accessorFn: (r) => r.serviceLabel },
  status: {
    id: "status",
    header: "Estado",
    accessorFn: (r) => SEVERITY[r.overall],
    sortDescFirst: true,
    cell: ({ row }) => (
      <StatusPill status={row.original.overall}>{row.original.statusLabel}</StatusPill>
    ),
  },
  owner: {
    id: "owner",
    header: "Propietario",
    accessorFn: (r) => r.ownerName ?? "",
    cell: ({ row }) =>
      row.original.ownerName ?? <span className="text-muted-foreground">Sin propietario</span>,
  },
  driver: {
    id: "driver",
    header: "Conductor",
    accessorFn: (r) => r.driverName ?? "",
    cell: ({ row }) => row.original.driverName ?? dash,
  },
  phone: {
    id: "phone",
    header: "Celular",
    accessorFn: (r) => r.driverPhone ?? "",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.driverPhone ? (
        <a
          href={`tel:${row.original.driverPhone}`}
          className="num underline-offset-2 hover:underline"
        >
          {row.original.driverPhone}
        </a>
      ) : (
        dash
      ),
  },
  policy: {
    id: "policy",
    header: "Póliza",
    accessorFn: (r) => dateOrUndefined(r.policy),
    sortUndefined: "last",
    cell: ({ row }) => pill(row.original.policy),
  },
  soat: {
    id: "soat",
    header: "SOAT",
    accessorFn: (r) => dateOrUndefined(r.soat),
    sortUndefined: "last",
    cell: ({ row }) => pill(row.original.soat),
  },
  tecno: {
    id: "tecno",
    header: "Tecno",
    accessorFn: (r) => dateOrUndefined(r.tecno),
    sortUndefined: "last",
    cell: ({ row }) => pill(row.original.tecno),
  },
  tax: {
    id: "tax",
    header: "Impuesto",
    accessorFn: (r) => r.tax.text,
    cell: ({ row }) => pill(row.original.tax),
  },
  lastOil: {
    id: "lastOil",
    header: "F. cambio",
    accessorFn: (r) => r.lastOilDate ?? undefined,
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.lastOilDate ? (
        <span className="num">{formatDisplayDate(row.original.lastOilDate)}</span>
      ) : (
        dash
      ),
  },
  km: {
    id: "km",
    header: "Kilometraje",
    accessorFn: (r) => r.km ?? undefined,
    sortUndefined: "last",
    meta: { align: "right" },
    cell: ({ row }) =>
      row.original.km != null ? (
        <span className="num">{formatKm(row.original.km)}</span>
      ) : row.original.odometerWorking ? (
        dash
      ) : (
        <span className="text-muted-foreground">No sirve</span>
      ),
  },
  nextChange: {
    id: "nextChange",
    header: "Próx. cambio",
    accessorFn: (r) => SEVERITY[r.nextChange.status],
    sortDescFirst: true,
    cell: ({ row }) => pill(row.original.nextChange),
  },
};

/** Same 15 columns, nested under their four group headers. */
export const vehicleColumns: ColumnDef<VehicleGridRow>[] = COLUMN_GROUPS.map((group) => ({
  id: `group-${group.key}`,
  header: group.label,
  meta: { groupKey: group.key },
  columns: group.columns.map((id) => leaves[id]),
}));
