import { AlertTriangle, Copy, SpellCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RECEIPT_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS,
  type ReceiptStatus,
  type SettlementStatus,
} from "../domain/settlement-rules";

export const BADGE = "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] leading-none font-semibold";

const RECEIPT_TONES: Record<ReceiptStatus, string> = {
  pending: "bg-warn text-warn-foreground",
  settled: "bg-secondary text-secondary-foreground",
  paid: "bg-ok text-ok-foreground",
};

const SETTLEMENT_TONES: Record<SettlementStatus, string> = {
  open: "bg-warn text-warn-foreground",
  paid: "bg-ok text-ok-foreground",
  annulled: "bg-muted text-muted-foreground",
};

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  return <span className={cn(BADGE, RECEIPT_TONES[status])}>{RECEIPT_STATUS_LABELS[status]}</span>;
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return <span className={cn(BADGE, SETTLEMENT_TONES[status])}>{SETTLEMENT_STATUS_LABELS[status]}</span>;
}

/** The written amount is far from tons times the tariff of that day. */
export function MismatchBadge() {
  return (
    <span className={cn(BADGE, "bg-warn text-warn-foreground")}>
      <AlertTriangle className="size-3" aria-hidden />
      Valor distinto a la tarifa
    </span>
  );
}

/** A plate or driver the AI read a little differently and the fleet's own was put in its place. */
export function CorrectedBadge() {
  return (
    <span className={cn(BADGE, "bg-ok text-ok-foreground")}>
      <SpellCheck className="size-3" aria-hidden />
      Corregido
    </span>
  );
}

export function DuplicateBadge({ where }: { where: "database" | "batch" }) {
  return (
    <span className={cn(BADGE, "bg-danger text-danger-foreground")}>
      <Copy className="size-3" aria-hidden />
      {where === "database" ? "Ya está registrado" : "Repetido en esta lista"}
    </span>
  );
}
