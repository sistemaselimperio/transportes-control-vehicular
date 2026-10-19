import type { AlertStatus } from "@/modules/alerts/domain/alert-status";

export type TaxKind =
  | "PAID_YEAR"
  | "EXEMPT"
  | "EXEMPT_LOW_DISPLACEMENT"
  | "UNKNOWN";

export function taxStatus(input: {
  kind: TaxKind;
  year?: number | null;
  currentYear: number;
}): AlertStatus {
  switch (input.kind) {
    case "EXEMPT":
    case "EXEMPT_LOW_DISPLACEMENT":
      return "not_applicable";
    case "UNKNOWN":
      return "warning"; // "sin dato"
    case "PAID_YEAR":
      if (input.year == null) return "warning";
      return input.year < input.currentYear ? "expired" : "ok";
  }
}
