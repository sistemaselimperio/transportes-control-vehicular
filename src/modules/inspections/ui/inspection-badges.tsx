import { CircleAlert, CircleCheck, Unlink } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const BADGE =
  "inline-flex items-center gap-1 rounded-[5px] px-2 py-1 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset";

/** Own badge instead of `StatusPill`, whose hidden text says "Vencido" / "Vigente". Icon + text, not colour alone. */
export function StatusBadge({ critical }: { critical: boolean }) {
  const Icon = critical ? CircleAlert : CircleCheck;
  return (
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
