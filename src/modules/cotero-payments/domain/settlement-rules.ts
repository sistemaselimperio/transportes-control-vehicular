/** States of receipts and settlements, and the transitions the business allows between them. */

export type ReceiptStatus = "pending" | "settled" | "paid";
export type SettlementStatus = "open" | "paid" | "annulled";

export const PAYMENT_METHODS = ["efectivo", "transferencia", "nequi", "daviplata", "otro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  otro: "Otro",
};

export const isPaymentMethod = (value: string): value is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(value);

/** A rule of the cotero payments refused the operation; the message is for the user. */
export class CoteroError extends Error {}

/** Only a pending receipt can still change. */
export function assertCanEditReceipt(status: ReceiptStatus): void {
  if (status !== "pending") {
    throw new CoteroError(
      status === "settled" ? "El recibo ya está en una liquidación: anúlala para editarlo." : "El recibo ya está pagado y no se puede editar.",
    );
  }
}

export function assertCanDeleteReceipt(status: ReceiptStatus): void {
  if (status !== "pending") {
    throw new CoteroError(
      status === "settled" ? "El recibo ya está en una liquidación: anúlala para eliminarlo." : "El recibo ya está pagado y no se puede eliminar.",
    );
  }
}

/** A settlement takes only pending receipts, and at least one. */
export function assertCanSettle(statuses: readonly ReceiptStatus[]): void {
  if (statuses.length === 0) throw new CoteroError("Elige al menos un recibo.");
  if (statuses.some((s) => s !== "pending")) {
    throw new CoteroError("Algún recibo ya no está pendiente: recarga e intenta de nuevo.");
  }
}

export const receiptStatusOnSettle = (): ReceiptStatus => "settled";

/** Annulling is only possible before the payment; a paid settlement is closed. */
export function assertCanAnnul(status: SettlementStatus): void {
  if (status === "paid") throw new CoteroError("La liquidación ya está pagada y no se puede anular.");
  if (status === "annulled") throw new CoteroError("La liquidación ya está anulada.");
}

export const receiptStatusAfterAnnul = (): ReceiptStatus => "pending";

export function assertCanPay(status: SettlementStatus): void {
  if (status === "paid") throw new CoteroError("La liquidación ya está pagada.");
  if (status === "annulled") throw new CoteroError("La liquidación está anulada.");
}

export const receiptStatusAfterPay = (): ReceiptStatus => "paid";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  pending: "Pendiente",
  settled: "Liquidado",
  paid: "Pagado",
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  open: "Por pagar",
  paid: "Pagada",
  annulled: "Anulada",
};
