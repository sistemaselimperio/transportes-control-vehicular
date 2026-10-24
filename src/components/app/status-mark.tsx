import type { ReactNode } from "react";
import type { AlertStatus } from "@/modules/alerts/domain/alert-status";
import { cn } from "@/lib/utils";

const WORDS: Record<AlertStatus, string> = {
  expired: "Vencido",
  warning: "Por vencer",
  ok: "Vigente",
  not_applicable: "No aplica",
  inactive: "Inactivo",
};

const DOT: Record<AlertStatus, string> = {
  expired: "bg-danger-foreground",
  warning: "bg-warn-foreground",
  ok: "bg-ok-foreground",
  not_applicable: "bg-muted-foreground",
  inactive: "bg-muted-foreground",
};

const TONE: Record<AlertStatus, string> = {
  expired: "font-medium text-danger-foreground",
  warning: "font-medium text-warn-foreground",
  ok: "text-muted-foreground",
  not_applicable: "text-muted-foreground",
  inactive: "text-muted-foreground",
};

/**
 * Quiet status signal: a 8px dot plus a word, no fill. Colour is never the only cue, because
 * the word always travels with the dot. `children` replaces the default word.
 */
export function StatusMark({
  status,
  children,
  className,
}: {
  status: AlertStatus;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[status])} />
      <span className={TONE[status]}>{children ?? WORDS[status]}</span>
    </span>
  );
}
