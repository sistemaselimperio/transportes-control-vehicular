import { Ban, CircleAlert, CircleCheck, Clock, Unlink } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ExitStatus } from "../domain/exit-decision";

const BADGE =
  "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset";

/**
 * Own badge instead of `StatusPill`, whose hidden text says "Vencido" / "Vigente". Icon + text, not colour alone.
 * `unchecked` (non-critical points left blank) sits as a small grey counter on the badge's corner.
 */
export function StatusBadge({ critical, unchecked = 0 }: { critical: boolean; unchecked?: number }) {
  const Icon = critical ? CircleAlert : CircleCheck;
  return (
    <span className="relative inline-flex">
      <span
        className={cn(
          BADGE,
          critical
            ? "bg-danger-foreground/15 text-danger-foreground ring-danger-foreground/40"
            : "bg-ok text-ok-foreground ring-ok-foreground/25",
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {critical ? "Crítico" : "OK"}
      </span>
      {unchecked > 0 && (
        <span
          title={`${unchecked} sin revisar`}
          className="num absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[0.625rem] leading-none font-semibold text-muted-foreground ring-1 ring-foreground/15"
        >
          {unchecked}
          <span className="sr-only"> sin revisar</span>
        </span>
      )}
    </span>
  );
}

/** The typed plate or national id matched no registered vehicle / driver. Informational, never an error. */
export function NotRegisteredBadge({ children }: { children: ReactNode }) {
  return (
    <span className={cn(BADGE, "bg-warn/60 text-warn-foreground ring-warn-foreground/30")}>
      <Unlink className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

const EXIT_BADGES: Record<ExitStatus, { label: string; icon: typeof Clock; className: string }> = {
  PENDING: { label: "Pendiente", icon: Clock, className: "bg-warn/60 text-warn-foreground ring-warn-foreground/30" },
  APTO: { label: "Apto", icon: CircleCheck, className: "bg-ok text-ok-foreground ring-ok-foreground/25" },
  NO_APTO: { label: "No apto", icon: Ban, className: "bg-danger-foreground/15 text-danger-foreground ring-danger-foreground/40" },
};

/** The maintenance chief's exit decision. Icon + text, not colour alone. */
export function ExitBadge({ status }: { status: ExitStatus }) {
  const { label, icon: Icon, className } = EXIT_BADGES[status];
  return (
    <span className={cn(BADGE, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">Salida: </span>
      {label}
    </span>
  );
}
