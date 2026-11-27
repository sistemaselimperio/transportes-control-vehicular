import { CircleCheck, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindowStatus } from "../domain/turn-rules";

const BADGE =
  "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset";

const STYLES: Record<WindowStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending: { label: "Pendiente", className: "bg-muted text-muted-foreground ring-border", Icon: Clock },
  open: { label: "Abierta", className: "bg-ok text-ok-foreground ring-ok-foreground/25", Icon: CircleCheck },
  closed: { label: "Cerrada", className: "bg-danger text-danger-foreground ring-danger-foreground/25", Icon: Lock },
};

/** The window state of a jornada; the label always carries the meaning. */
export function WindowBadge({ status }: { status: WindowStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span className={cn(BADGE, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}
