"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  DEFAULT_FILTERS,
  filterVehicleRows,
  type VehicleFilters,
} from "../domain/vehicle-filters";
import type { VehicleGridRow } from "../domain/vehicle-row";
import { VehicleCards } from "./vehicle-cards";
import { vehicleColumns } from "./vehicle-columns";
import { VehicleFiltersBar } from "./vehicle-filters-bar";
import { VehicleTable } from "./vehicle-table";

const sortToValue = (s: SortingState) =>
  s[0] ? `${s[0].id}:${s[0].desc ? "desc" : "asc"}` : "status:desc";

/** Interactive grid: owns filter/sort state; receives all rows as props. */
export function VehicleGrid({
  rows,
  initialFilters = DEFAULT_FILTERS,
}: {
  rows: VehicleGridRow[];
  initialFilters?: VehicleFilters;
}) {
  const [filters, setFilters] = useState<VehicleFilters>(initialFilters);
  const [sorting, setSorting] = useState<SortingState>([{ id: "plate", desc: false }]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const owners = useMemo(
    () => [...new Set(rows.map((r) => r.ownerName).filter((n): n is string => !!n))].sort(),
    [rows],
  );
  const classes = useMemo(() => [...new Set(rows.map((r) => r.className))].sort(), [rows]);
  const filtered = useMemo(() => filterVehicleRows(rows, filters), [rows, filters]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not memoizable by the React Compiler
  const table = useReactTable({
    data: filtered,
    columns: vehicleColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visible = table.getRowModel().rows.map((r) => r.original);

  async function exportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/vehiculos/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plates: visible.map((r) => r.plate) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `vehiculos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("No se pudo exportar el archivo. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <VehicleFiltersBar
        filters={filters}
        onChange={setFilters}
        owners={owners}
        classes={classes}
        shown={visible.length}
        total={rows.length}
        sortValue={sortToValue(sorting)}
        onSortChange={(value) => {
          const [id, dir] = value.split(":");
          setSorting([{ id, desc: dir === "desc" }]);
        }}
        onExport={exportExcel}
        exporting={exporting}
        exportError={exportError}
      />

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay vehículos con estos filtros.
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <VehicleTable table={table} />
          </div>
          <div className="md:hidden">
            <VehicleCards rows={visible} />
          </div>
        </>
      )}
    </div>
  );
}
