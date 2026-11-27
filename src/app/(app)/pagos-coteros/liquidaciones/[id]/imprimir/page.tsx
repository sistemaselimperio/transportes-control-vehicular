import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCoteroPaymentsAccess } from "@/lib/session";
import { loadSettlementWithReceipts } from "@/modules/cotero-payments/infrastructure/cotero-repository";
import { buildSettlementVoucher } from "@/modules/cotero-payments/domain/settlement-voucher";
import { SettlementVoucher } from "@/modules/cotero-payments/ui/settlement-voucher";
import { VoucherPrintBar } from "@/modules/cotero-payments/ui/voucher-print-bar";

export const metadata = { title: "Comprobante de liquidación" };

/** The printable voucher of one settlement; opens the print dialog on load. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireCoteroPaymentsAccess();
  const { id } = await params;
  const settlementId = z.coerce.number().int().positive().safeParse(id);
  if (!settlementId.success) notFound();

  const found = await loadSettlementWithReceipts(settlementId.data);
  if (!found || found.settlement.status === "annulled") notFound();

  return (
    <>
      <VoucherPrintBar title={`Liquidación ${found.settlement.number} · ${found.settlement.coteroName}`} />
      <SettlementVoucher voucher={buildSettlementVoucher(found.settlement, found.receipts)} />
    </>
  );
}
