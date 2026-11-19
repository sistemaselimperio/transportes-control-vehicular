import { CircleCheck, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DELIVERY_PRIORITY_LABELS,
  DELIVERY_STATUS_LABELS,
  type DeliveryPriority,
  type DeliveryStatus,
} from "../domain/delivery-rules";

const BADGE =
  "inline-flex max-w-full items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset";

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  pendiente: "bg-muted text-muted-foreground ring-border",
  entregado: "bg-ok text-ok-foreground ring-ok-foreground/25",
};

/** Colored badge of a delivery status; the label always carries the meaning. */
export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const Icon = status === "entregado" ? CircleCheck : Clock;
  return (
    <span className={cn(BADGE, STATUS_STYLES[status])}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{DELIVERY_STATUS_LABELS[status]}</span>
    </span>
  );
}

/** Only urgent deliveries carry a badge; normal ones stay unmarked. */
export function DeliveryPriorityBadge({ priority }: { priority: DeliveryPriority }) {
  if (priority !== "urgente") return null;
  return (
    <span className={cn(BADGE, "bg-danger text-danger-foreground ring-danger-foreground/25")}>
      <Flame aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{DELIVERY_PRIORITY_LABELS[priority]}</span>
    </span>
  );
}
