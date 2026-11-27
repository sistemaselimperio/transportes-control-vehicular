"use client";

import { ChevronRight } from "lucide-react";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { CoteroSummary } from "../domain/cotero-summary";
import { formatCop } from "./format";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One row per cotero, the one with the most recent receipt first; tapping a row opens their receipts. */
export function CoteroList({ coteros, onOpen }: { coteros: readonly CoteroSummary[]; onOpen: (key: string) => void }) {
  if (coteros.length === 0) return <p className="text-sm text-muted-foreground">No hay recibos para este filtro.</p>;
  return (
    <ul className="grid gap-2">
      {coteros.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => onOpen(c.key)}
            className="panel flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <span className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4">
              <span className="block min-w-0">
                <span className="block truncate font-medium">{c.name}</span>
                {c.document && <span className="num block text-xs text-muted-foreground">C.C. {c.document}</span>}
              </span>
              <span className="num mt-1 block text-sm text-muted-foreground md:mt-0">
                {plural(c.count, "recibo", "recibos")}
                {" · "}
                {c.pending.count === 0 ? "sin pendientes" : plural(c.pending.count, "pendiente", "pendientes")}
              </span>
              <span className="num block text-sm font-semibold md:text-right">
                {c.pending.count === 0 ? <span className="font-normal text-muted-foreground">Al día</span> : formatCop(c.pending.amount)}
              </span>
              <span className="num block text-xs text-muted-foreground md:text-right">Último: {formatDisplayDate(c.lastDate)}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
