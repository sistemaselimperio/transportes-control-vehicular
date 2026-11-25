"use client";

import { flexRender, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { VehicleGridRow } from "../domain/vehicle-row";

/** Multi-select of the fleet list; absent for users who cannot edit vehicles. */
export interface FleetSelection {
  selected: ReadonlySet<string>;
  /** Plates that can be selected at all (not sold) among the rows shown. */
  selectable: readonly string[];
  onToggle: (plate: string) => void;
  onToggleAll: () => void;
}

/**
 * Desktop grid: group headers over the Excel headers, sticky class + plate,
 * sortable headers. Rows are keyboard-reachable through the plate link.
 */
export function VehicleTable({ table, selection }: { table: Table<VehicleGridRow>; selection?: FleetSelection }) {
  const router = useRouter();
  const [groupRow, leafRow] = table.getHeaderGroups();
  const chosen = selection ? selection.selectable.filter((p) => selection.selected.has(p)).length : 0;
  const allChosen = !!selection && selection.selectable.length > 0 && chosen === selection.selectable.length;

  return (
    <div
      id="fleet-table"
      className="relative min-h-0 flex-1 overflow-auto rounded-2xl border bg-card"
    >
      <table className="w-full min-w-max border-separate border-spacing-0 text-[0.8125rem]">
        <thead className="sticky top-0 z-20">
          <tr>
            {groupRow.headers.map((header, i) => (
              <th
                key={header.id}
                colSpan={header.colSpan}
                scope="colgroup"
                className={cn(
                  "h-7 border-b bg-muted px-0 text-left",
                  i > 0 && "border-l",
                )}
              >
                {/* The label sticks to the left so it stays readable while the group scrolls. */}
                <span className="micro-label sticky left-0 inline-flex items-center gap-2 px-3 text-foreground">
                  <span aria-hidden className="size-1.5 bg-foreground/40" />
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </span>
              </th>
            ))}
          </tr>
          <tr>
            {leafRow.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              const canSort = header.column.getCanSort();
              const meta = header.column.columnDef.meta;
              const firstOfGroup = header.column.parent?.columns[0]?.id === header.column.id;
              return (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={
                    sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                  }
                  className={cn(
                    "border-b bg-muted px-2.5 py-1 text-left whitespace-nowrap",
                    meta?.align === "right" && "text-right",
                    meta?.className,
                    meta?.className && "z-30",
                    firstOfGroup && header.column.parent?.id !== groupRow.headers[0]?.id && "border-l",
                  )}
                >
                  {selection && header.column.id === "className" && (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los vehículos de la lista"
                      className="mr-2 size-4 cursor-pointer align-middle"
                      checked={allChosen}
                      ref={(el) => {
                        if (el) el.indeterminate = chosen > 0 && !allChosen;
                      }}
                      disabled={selection.selectable.length === 0}
                      onChange={selection.onToggleAll}
                    />
                  )}
                  {canSort ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "micro-label inline-flex min-h-7 items-center gap-1 rounded outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70",
                        meta?.align === "right" && "flex-row-reverse",
                        sorted && "text-foreground",
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === "asc" ? (
                        <ChevronUp className="size-3.5" aria-hidden />
                      ) : sorted === "desc" ? (
                        <ChevronDown className="size-3.5" aria-hidden />
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                      )}
                    </button>
                  ) : (
                    <span className="micro-label">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/flota/${encodeURIComponent(row.original.plate)}`)}
              className="group cursor-pointer transition-colors duration-150 hover:bg-muted"
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                const firstOfGroup =
                  cell.column.parent?.columns[0]?.id === cell.column.id &&
                  cell.column.parent?.id !== groupRow.headers[0]?.id;
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      "border-b px-2.5 py-1 align-middle whitespace-nowrap",
                      meta?.align === "right" && "text-right",
                      firstOfGroup && "border-l",
                      meta?.className,
                    )}
                  >
                    {selection && cell.column.id === "className" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${row.original.plate}`}
                          className="size-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          checked={selection.selected.has(row.original.plate)}
                          disabled={row.original.vehicleStatus === "SOLD"}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => selection.onToggle(row.original.plate)}
                        />
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
