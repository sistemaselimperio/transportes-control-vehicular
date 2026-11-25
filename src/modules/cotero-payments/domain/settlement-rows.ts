import type { PaymentMethod, SettlementStatus } from "./settlement-rules";

/** A settlement as listed. Name, cédula and payment method are the snapshot taken when it was made. */
export interface SettlementRow {
  id: number;
  number: number;
  date: string;
  coteroKey: string;
  coteroName: string;
  coteroDocument: string | null;
  paymentMethod: PaymentMethod | null;
  paymentAccount: string | null;
  total: number;
  status: SettlementStatus;
  paidAt: string | null;
  hasProof: boolean;
  /** Receipts it holds now: none once it is annulled (they went back to pending). */
  receiptCount: number;
}

export interface TariffRow {
  id: number;
  validFrom: string;
  pricePerTon: number;
}

/** What is remembered about a cotero to fill the next settlement. */
export interface CoteroProfileRow {
  key: string;
  name: string;
  document: string | null;
  paymentMethod: PaymentMethod | null;
  paymentAccount: string | null;
}
