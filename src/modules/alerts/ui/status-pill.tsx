import { CircleAlert, CircleCheck, Clock, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { AlertStatus } from "@/modules/alerts/domain/alert-status";
import { cn } from "@/lib/utils";

const STYLES: Record<AlertStatus, { className: string; label: string }> = {
  expired: {
    className:
      "bg-danger text-danger-foreground ring-danger-foreground/40",
    label: "Vencido",
  },
  warning: {
    className:
      "bg-warn/60 text-warn-foreground ring-warn-foreground/30",
    label: "Por vencer o sin dato",
  },
  ok: {
    className:
      "bg-ok text-ok-foreground ring-ok-foreground/25",
    label: "Vigente",
  },
  not_applicable: {
    className: "bg-muted text-muted-foreground ring-border",
    label: "No aplica",
  },
  inactive: {
    className: "bg-muted text-muted-foreground ring-border",
    label: "Inactivo",
  },
};

function Icon({ status }: { status: AlertStatus }) {
  const props = { "aria-hidden": true, className: "size-3.5 shrink-0" } as const;
  switch (status) {
    case "expired":
      return <CircleAlert {...props} />;
    case "warning":
      return <Clock {...props} />;
    case "ok":
      return <CircleCheck {...props} />;
    default:
      return <Minus {...props} />;
  }
}

/**
 * Traffic-light badge: colour is never the only signal (icon + hidden text). `muted` greys it out
 * but keeps the real status (icon and text), for the alerts of a parked vehicle: they stay
 * visible so people know what is missing, without looking urgent.
 */
export function StatusPill({
  status,
  children,
  className,
  muted = false,
}: {
  status: AlertStatus;
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  const style = STYLES[status];
  return (
    <span
      title={muted ? `${style.label} (alerta silenciada: vehículo quieto o en taller)` : undefined}
      className={cn(
        "relative inline-flex max-w-full items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap tabular-nums ring-1 ring-inset",
        muted ? "bg-muted text-muted-foreground ring-border" : style.className,
        className,
      )}
    >
      <Icon status={status} />
      <span className="sr-only">{style.label}: </span>
      <span className="truncate">{children}</span>
    </span>
  );
}
