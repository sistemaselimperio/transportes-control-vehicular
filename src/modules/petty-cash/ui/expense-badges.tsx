import { AlertTriangle, Copy } from "lucide-react";
import { PlateText } from "@/components/app/plate-text";
import { cn } from "@/lib/utils";
import { splitPlate } from "@/modules/vehicles/domain/plate";
import { RESPONSIBILITY_LABELS, type ResponsibilityType } from "../domain/expense";

const BADGE = "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] leading-none font-semibold";

/** An AI-imported expense that still has to be checked by a person. */
export function ReviewBadge() {
  return (
    <span className={cn(BADGE, "bg-warn text-warn-foreground")}>
      <AlertTriangle className="size-3" aria-hidden />
      Por revisar
    </span>
  );
}

export function DuplicateBadge() {
  return (
    <span className={cn(BADGE, "bg-danger text-danger-foreground")}>
      <Copy className="size-3" aria-hidden />
      Posible duplicado
    </span>
  );
}

/** Tax responsibility of the supplier; the electronic invoicer is highlighted like on the paper sheet. */
export function ResponsibilityBadge({ type }: { type: ResponsibilityType }) {
  return (
    <span className={cn(BADGE, "font-medium", type === "electronic_invoicer" ? "bg-warn text-warn-foreground" : "bg-muted text-foreground")}>
      {RESPONSIBILITY_LABELS[type]}
    </span>
  );
}

/** The vehicle of an expense: a plate chip when it is a plate, plain text for a free destination. */
export function VehicleChip({ label }: { label: string }) {
  if (splitPlate(label)) {
    return (
      <span className="plate">
        <PlateText plate={label} />
      </span>
    );
  }
  return <span className="rounded-md border bg-muted px-1.5 py-1 text-xs leading-none font-semibold">{label}</span>;
}
