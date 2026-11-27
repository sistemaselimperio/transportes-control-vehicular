/** The printable voucher of a settlement ("LIQUIDACIÓN DE CARGUE Y DESCARGUE"), as ready-to-print text. */
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { pesosInWords } from "./number-words";
import type { SettlementRow } from "./settlement-rows";
import { PAYMENT_METHOD_LABELS } from "./settlement-rules";
import { settlementSheetLines } from "./sheet-format";

const withDots = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "12,36 t": decimal comma, no trailing zeros, up to three decimals. */
export const formatVoucherUnits = (tons: number): string => `${formatDecimal(tons, 3)} t`;

/** "$ 121.128". */
export const formatVoucherPesos = (pesos: number): string => `$ ${withDots(String(Math.round(pesos)))}`;

/** A cédula with dot grouping: "1.056.507.092". */
export const formatVoucherDocument = (document: string | null): string => (document ? withDots(document) : "");

export interface VoucherLine {
  day: string;
  units: string;
  unitPrice: string;
  total: string;
}

export interface SettlementVoucher {
  coteroName: string;
  date: string;
  document: string;
  lines: VoucherLine[];
  totalUnits: string;
  totalAmount: string;
  /** "NEQUI · 3001234567"; empty when the way of paying is not defined. */
  payment: string;
  amountInWords: string;
}

/** Everything the voucher shows, from the settlement and its receipts (what each receipt says is what is paid). */
export function buildSettlementVoucher(
  settlement: Pick<SettlementRow, "coteroName" | "coteroDocument" | "date" | "paymentMethod" | "paymentAccount">,
  receipts: Parameters<typeof settlementSheetLines>[0],
): SettlementVoucher {
  const lines = settlementSheetLines(receipts);
  const tons = Math.round(lines.reduce((sum, l) => sum + l.tons, 0) * 1000) / 1000;
  const total = lines.reduce((sum, l) => sum + l.total, 0);
  const method = settlement.paymentMethod ? PAYMENT_METHOD_LABELS[settlement.paymentMethod].toUpperCase() : "";
  return {
    coteroName: settlement.coteroName,
    date: formatDisplayDate(settlement.date),
    document: formatVoucherDocument(settlement.coteroDocument),
    lines: lines.map((l) => ({
      day: l.day,
      units: formatVoucherUnits(l.tons),
      unitPrice: formatVoucherPesos(l.unitPrice),
      total: formatVoucherPesos(l.total),
    })),
    totalUnits: formatVoucherUnits(tons),
    totalAmount: formatVoucherPesos(total),
    payment: [method, settlement.paymentAccount].filter(Boolean).join(" · "),
    amountInWords: pesosInWords(total),
  };
}
