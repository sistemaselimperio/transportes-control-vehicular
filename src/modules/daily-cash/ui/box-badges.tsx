import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { BOX_STATUS_LABELS, type BoxStatus } from "../domain/box-rules";

/** Open or closed, in words and with an icon so it never relies on color alone. */
export function StatusBadge({ status }: { status: BoxStatus }) {
  const Icon = status === "open" ? LockOpen : Lock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] leading-none font-semibold",
        status === "open" ? "bg-ok text-ok-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {BOX_STATUS_LABELS[status]}
    </span>
  );
}

/** The difference of a box: red and signed when it is not zero. */
export function DifferenceValue({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("num", value !== 0 && "font-semibold text-destructive", className)}>
      {value > 0 ? "+" : ""}
      {formatPrice(value)}
    </span>
  );
}
