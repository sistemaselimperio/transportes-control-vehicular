"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { BalanceTripRow } from "../domain/load-balance";

/** The trips that already carried part of a balance; with `onDelete` each one can be removed to correct a mistake. */
export function BalanceTrips({
  trips,
  onDelete,
}: {
  trips: readonly BalanceTripRow[];
  onDelete?: (trip: BalanceTripRow) => void;
}) {
  if (trips.length === 0) return null;
  return (
    <ul className="divide-y rounded-lg border bg-background text-xs">
      {trips.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-2 px-2.5 py-1">
          <span className="num min-w-0">
            {formatDisplayDate(t.date)} · {t.plate}
          </span>
          <span className="num flex shrink-0 items-center gap-1 text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{formatDecimal(t.bags, 0)}</span> {t.bags === 1 ? "bulto" : "bultos"}
            </span>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-destructive md:size-7"
                aria-label={`Eliminar el viaje del ${formatDisplayDate(t.date)} (${t.plate})`}
                title="Eliminar viaje"
                onClick={() => onDelete(t)}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
