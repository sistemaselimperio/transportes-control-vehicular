"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ACTION_TITLES,
  ActionFormBody,
  KIND_LABELS,
  pillText,
} from "@/modules/alerts/ui/attention-actions";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import type { ItemKind } from "@/modules/dashboard/domain/dashboard-metrics";
import type { QueueVehicle } from "../domain/vehicle-queue";

/**
 * One vehicle's pending items and the form that resolves the chosen one.
 * Shared by the desktop side panel and the phone sheet; it fills the height
 * its parent gives it and only the form fields scroll.
 */
export function VehicleDetail({
  vehicle,
  kind,
  onSelectKind,
  onDone,
  onCancel,
  showPlate = true,
}: {
  vehicle: QueueVehicle;
  kind: ItemKind;
  onSelectKind: (kind: ItemKind) => void;
  onDone: (message: string) => void;
  onCancel: () => void;
  showPlate?: boolean;
}) {
  const item = vehicle.items.find((i) => i.kind === kind) ?? vehicle.items[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
        {showPlate ? <span className="plate">{vehicle.plate}</span> : <span className="micro-label">Pendientes</span>}
        <Link
          href={`/flota/${encodeURIComponent(vehicle.plate)}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-foreground outline-none transition-colors duration-150 hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/70 md:min-h-9"
        >
          Ver ficha
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>

      <ul className="shrink-0 divide-y border-b" aria-label={`Pendientes de ${vehicle.plate}`}>
        {vehicle.items.map((i) => {
          const selected = i === item;
          return (
            <li key={i.kind}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectKind(i.kind)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 px-5 py-2 text-left outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset",
                  selected && "bg-secondary hover:bg-secondary",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{KIND_LABELS[i.kind]}</span>
                  <span className="num block truncate text-xs text-muted-foreground">{i.detail}</span>
                </span>
                <StatusPill status={i.status} className="flex-none">
                  {pillText(i)}
                </StatusPill>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex min-h-0 flex-1 flex-col">
        <h3 className="micro-label shrink-0 px-5 pt-4 pb-1 text-foreground">
          {ACTION_TITLES[item.kind]}
        </h3>
        <ActionFormBody key={`${item.plate}:${item.kind}`} item={item} onDone={onDone} onCancel={onCancel} />
      </div>
    </div>
  );
}
