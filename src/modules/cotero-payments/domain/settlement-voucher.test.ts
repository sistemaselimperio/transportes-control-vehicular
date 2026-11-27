import { describe, expect, it } from "vitest";
import type { ReceiptRow } from "./receipt-rules";
import type { SettlementRow } from "./settlement-rows";
import { buildSettlementVoucher, formatVoucherDocument, formatVoucherPesos, formatVoucherUnits } from "./settlement-voucher";

describe("formatVoucherUnits", () => {
  it("uses the decimal comma, trims trailing zeros and keeps up to three decimals", () => {
    expect(formatVoucherUnits(12.36)).toBe("12,36 t");
    expect(formatVoucherUnits(33.213)).toBe("33,213 t");
    expect(formatVoucherUnits(12)).toBe("12 t");
    expect(formatVoucherUnits(12.8)).toBe("12,8 t");
  });

  it("groups the thousands with dots", () => {
    expect(formatVoucherUnits(1234.5)).toBe("1.234,5 t");
  });
});

describe("formatVoucherPesos", () => {
  it("writes the sign, a space and the thousands with dots", () => {
    expect(formatVoucherPesos(121128)).toBe("$ 121.128");
    expect(formatVoucherPesos(9800)).toBe("$ 9.800");
    expect(formatVoucherPesos(800)).toBe("$ 800");
    expect(formatVoucherPesos(1234567)).toBe("$ 1.234.567");
    expect(formatVoucherPesos(0)).toBe("$ 0");
  });
});

describe("formatVoucherDocument", () => {
  it("groups a cédula with dots", () => {
    expect(formatVoucherDocument("1056507092")).toBe("1.056.507.092");
  });

  it("leaves an empty one empty", () => {
    expect(formatVoucherDocument(null)).toBe("");
  });
});

describe("buildSettlementVoucher", () => {
  const settlement: SettlementRow = {
    id: 3,
    number: 12,
    date: "2026-11-30",
    coteroKey: "doc:1056507092",
    coteroName: "Juan Pérez",
    coteroDocument: "1056507092",
    paymentMethod: "nequi",
    paymentAccount: "3001234567",
    total: 787528,
    status: "open",
    paidAt: null,
    hasProof: false,
    receiptCount: 2,
  };
  const receipt = (over: Partial<ReceiptRow>) => ({ date: "2026-11-16", tons: 12.36, tariffPerTon: 9800, amount: 121128, ...over }) as ReceiptRow;
  const receipts = [receipt({}), receipt({ date: "2026-11-17", tons: 67.99, tariffPerTon: 9800, amount: 666400 })];

  it("fills the header with the cotero, the date and the grouped cédula", () => {
    const v = buildSettlementVoucher(settlement, receipts);
    expect(v.coteroName).toBe("Juan Pérez");
    expect(v.date).toBe("30/11/2026");
    expect(v.document).toBe("1.056.507.092");
  });

  it("makes one formatted line per receipt", () => {
    const v = buildSettlementVoucher(settlement, receipts);
    expect(v.lines).toEqual([
      { day: "16 DE NOVIEMBRE", units: "12,36 t", unitPrice: "$ 9.800", total: "$ 121.128" },
      { day: "17 DE NOVIEMBRE", units: "67,99 t", unitPrice: "$ 9.800", total: "$ 666.400" },
    ]);
  });

  it("totals the tons and the amount and writes the amount in words", () => {
    const v = buildSettlementVoucher(settlement, receipts);
    expect(v.totalUnits).toBe("80,35 t");
    expect(v.totalAmount).toBe("$ 787.528");
    expect(v.amountInWords).toBe("SETECIENTOS OCHENTA Y SIETE MIL QUINIENTOS VEINTIOCHO PESOS");
  });

  it("says how it is paid", () => {
    expect(buildSettlementVoucher(settlement, receipts).payment).toBe("NEQUI · 3001234567");
    expect(buildSettlementVoucher({ ...settlement, paymentMethod: null, paymentAccount: null }, receipts).payment).toBe("");
  });
});
