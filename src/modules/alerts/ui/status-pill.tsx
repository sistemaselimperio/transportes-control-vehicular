import { CircleAlert, CircleCheck, Clock, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { AlertStatus } from "@/modules/alerts/domain/alert-status";
import { cn } from "@/lib/utils";

const STYLES: Record<AlertStatus, { className: string; label: string }> = {
  expired: {
    className:
      "bg-red-100 text-red-900 ring-red-300 dark:bg-red-950 dark:text-red-100 dark:ring-red-800",
    label: "Vencido",
  },
  warning: {
    className:
      "bg-amber-100 text-amber-950 ring-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800",
    label: "Por vencer o sin dato",
  },
  ok: {
    className:
      "bg-green-100 text-green-900 ring-green-300 dark:bg-green-950 dark:text-green-100 dark:ring-green-800",
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

/** Traffic-light badge: colour is never the only signal (icon + hidden text). */
export function StatusPill({
  status,
  children,
  className,
}: {
  status: AlertStatus;
  children: ReactNode;
  className?: string;
}) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        style.className,
        className,
      )}
    >
      <Icon status={status} />
      <span className="sr-only">{style.label}: </span>
      <span className="truncate">{children}</span>
    </span>
  );
}
