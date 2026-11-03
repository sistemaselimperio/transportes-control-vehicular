import { CircleCheck, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Progress, ProgressState } from "@/modules/shared/domain/progress";

const STYLES: Record<ProgressState, string> = {
  complete: "text-ok-foreground",
  partial: "text-warn-foreground",
  missing: "text-muted-foreground",
};

const LABELS: Record<ProgressState, string> = {
  complete: "completos",
  partial: "incompletos",
  missing: "sin cargar",
};

/**
 * Compact completeness indicator: a check when complete, "7/10" when partial, a dashed circle
 * when nothing is on record. The full wording goes to the tooltip and screen readers.
 */
export function ProgressBadge({
  subject,
  progress,
  prefix,
  className,
}: {
  /** What is counted, e.g. "Datos técnicos". */
  subject: string;
  progress: Progress;
  /** Short visible label, for places without a column header (the phone cards). */
  prefix?: string;
  className?: string;
}) {
  const { known, total, state } = progress;
  const label = `${subject} ${LABELS[state]} (${known} de ${total})`;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs leading-none font-medium tabular-nums", STYLES[state], className)}
      title={label}
    >
      <span className="sr-only">{label}</span>
      {prefix && <span aria-hidden className="text-muted-foreground">{prefix}</span>}
      {state === "complete" && <CircleCheck className="size-4 shrink-0" aria-hidden />}
      {state === "missing" && <CircleDashed className="size-4 shrink-0" aria-hidden />}
      {state === "partial" && <span aria-hidden>{`${known}/${total}`}</span>}
    </span>
  );
}
