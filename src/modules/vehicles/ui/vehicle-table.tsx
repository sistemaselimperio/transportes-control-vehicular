"use client";

import { flexRender, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { VehicleGridRow } from "../domain/vehicle-row";

/** Desktop grid with the Excel headers; sticky class + plate, sortable headers. */
export function VehicleTable({ table }: { table: Table<VehicleGridRow> }) {
  const router = useRouter();

  return (
    <div className="max-h-[calc(100dvh-14rem)] overflow-auto rounded-lg border">
      <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20 bg-muted">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const meta = header.column.columnDef.meta;
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                    className={cn(
                      "border-b bg-muted px-2 py-2 text-left text-xs font-semibold whitespace-nowrap",
                      meta?.className,
                      meta?.className && "z-30",
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ChevronUp className="size-3.5" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ChevronDown className="size-3.5" aria-hidden />
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() =>
                router.push(`/vehiculos/${encodeURIComponent(row.original.plate)}`)
              }
              className="group cursor-pointer hover:bg-muted"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    "border-b px-2 py-1.5 align-middle whitespace-nowrap",
                    cell.column.columnDef.meta?.className,
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
