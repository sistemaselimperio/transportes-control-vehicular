"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COLUMN_GROUPS,
  type ColumnGroupKey,
} from "../domain/column-groups";

/** Show/hide the optional column groups of the grid (the vehicle group stays). */
export function ColumnGroupToggles({
  hidden,
  onToggle,
}: {
  hidden: ReadonlySet<ColumnGroupKey>;
  onToggle: (key: ColumnGroupKey) => void;
}) {
  return (
    <div role="group" aria-label="Columnas visibles" className="flex flex-wrap items-center gap-2">
      <span className="micro-label mr-1">Columnas</span>
      {COLUMN_GROUPS.filter((g) => !g.pinned).map((g) => {
        const shown = !hidden.has(g.key);
        return (
          <button
            key={g.key}
            type="button"
            aria-pressed={shown}
            onClick={() => onToggle(g.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.98]",
              shown
                ? "border-primary/60 bg-muted text-foreground"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Check className={cn("size-3.5", !shown && "opacity-0")} aria-hidden />
            {g.label}
          </button>
        );
      })}
    </div>
  );
}
