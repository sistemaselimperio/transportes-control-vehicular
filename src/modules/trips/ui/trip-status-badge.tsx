import { CircleCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRIP_STATUS_LABELS, type TripStatus } from "../domain/trip-status";

const STYLES: Record<TripStatus, string> = {
  programado: "bg-muted text-muted-foreground ring-border",
  entregado: "bg-ok text-ok-foreground ring-ok-foreground/25",
};

const ICONS = { programado: Clock, entregado: CircleCheck } as const;

/** Colored badge of a trip status; the label always carries the meaning, colour is never the only signal. */
export function TripStatusBadge({ status }: { status: TripStatus }) {
  const Icon = ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset",
        STYLES[status],
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{TRIP_STATUS_LABELS[status]}</span>
    </span>
  );
}
