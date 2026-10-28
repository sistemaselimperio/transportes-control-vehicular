"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStoredString } from "@/lib/use-stored-state";
import {
  columnVisibility,
  parseHiddenGroups,
  serializeHiddenGroups,
  toggleGroup,
  type ColumnGroupKey,
} from "../domain/column-groups";
import {
  countByView,
  filtersForView,
  parseViewParam,
  type FleetView,
} from "../domain/fleet-views";
import { filterVehicleRows, ownerOptions, type GroupFilter, type VehicleFilters } from "../domain/vehicle-filters";
import type { VehicleGridRow } from "../domain/vehicle-row";
import { ColumnGroupToggles } from "./column-group-toggles";
import { FleetViewTabs } from "./fleet-view-tabs";
import { VehicleCards } from "./vehicle-cards";
import { vehicleColumns } from "./vehicle-columns";
import { VehicleFiltersBar } from "./vehicle-filters-bar";
import { VehicleTable } from "./vehicle-table";

const STORAGE_KEY = "fleet.hiddenColumnGroups";

type LocalFilters = Pick<VehicleFilters, "search" | "owner" | "className">;
const NO_LOCAL_FILTERS: LocalFilters = { search: "", owner: "", className: "" };

const sortToValue = (s: SortingState) =>
  s[0] ? `${s[0].id}:${s[0].desc ? "desc" : "asc"}` : "status:desc";

/** Interactive fleet list: owns view, filter and sort state; receives all rows as props. */
export function VehicleGrid({
  rows,
  group,
}: {
  rows: VehicleGridRow[];
  /** Owner group from the sidebar (`?grupo=`). */
  group: GroupFilter;
}) {
  // The URL (`?vista=`) is the single source of truth for the active tab.
  const view = parseViewParam(useSearchParams().get("vista") ?? undefined);
  const [local, setLocal] = useState<LocalFilters>(NO_LOCAL_FILTERS);
  const [sorting, setSorting] = useState<SortingState>([{ id: "plate", desc: false }]);
  const [storedHidden, setStoredHidden] = useStoredString(STORAGE_KEY);
  const hidden = useMemo(() => parseHiddenGroups(storedHidden), [storedHidden]);

  const owners = useMemo(() => ownerOptions(rows), [rows]);
  const classes = useMemo(() => [...new Set(rows.map((r) => r.className))].sort(), [rows]);
  const counts = useMemo(() => countByView(rows, group), [rows, group]);
  const filtered = useMemo(
    () => filterVehicleRows(rows, { ...filtersForView(view), group, ...local }),
    [rows, view, group, local],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not memoizable by the React Compiler
  const table = useReactTable({
    data: filtered,
    columns: vehicleColumns,
    state: { sorting, columnVisibility: columnVisibility(hidden) },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const visible = table.getRowModel().rows.map((r) => r.original);

  function selectView(next: FleetView) {
    // history.replaceState feeds useSearchParams without re-running the server page.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("vista", next);
      window.history.replaceState(null, "", url);
    } catch {
      // The URL is a convenience; the tab still switches.
    }
  }

  function toggle(key: ColumnGroupKey) {
    setStoredHidden(serializeHiddenGroups(toggleGroup(hidden, key)));
  }

  const clear = () => setLocal(NO_LOCAL_FILTERS);

  return (
    <div className="space-y-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-4 md:space-y-0">
      <FleetViewTabs active={view} counts={counts} onSelect={selectView} />

      <div
        id="fleet-panel"
        role="tabpanel"
        aria-labelledby={`fleet-tab-${view}`}
        className="space-y-3 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-3 md:space-y-0"
      >
        <VehicleFiltersBar
          filters={local}
          onChange={(next) => setLocal((prev) => ({ ...prev, ...next }))}
          onClear={clear}
          owners={owners}
          classes={classes}
          sortValue={sortToValue(sorting)}
          onSortChange={(value) => {
            const [id, dir] = value.split(":");
            setSorting([{ id, desc: dir === "desc" }]);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p aria-live="polite" className="num text-sm text-muted-foreground">
            {visible.length} de {counts[view]} vehículos
          </p>
          <div className="hidden md:block">
            <ColumnGroupToggles hidden={hidden} onToggle={toggle} />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay vehículos en esta vista con estos filtros.</p>
            {(local.search || local.owner || local.className) && (
              <Button type="button" variant="outline" className="mt-4 h-11" onClick={clear}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Fills the remaining viewport so both scrollbars stay on screen. */}
            <div className="hidden md:flex md:min-h-0 md:flex-1 md:flex-col">
              <VehicleTable table={table} />
            </div>
            <div className="md:hidden">
              <VehicleCards rows={visible} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
