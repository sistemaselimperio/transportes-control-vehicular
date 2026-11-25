import { z } from "zod";
import { coteroRouteGuard } from "@/modules/cotero-payments/application/route-guard";
import { loadSettlementWithReceipts } from "@/modules/cotero-payments/infrastructure/cotero-repository";
import { buildSettlementWorkbook, XLSX_MIME } from "@/modules/cotero-payments/infrastructure/excel-exports";

/** The settlement sheet ("Liquidación de cargue y descargue") of one settlement, as an Excel file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await coteroRouteGuard();
  if (denied) return denied;

  const { id } = await params;
  const settlementId = z.coerce.number().int().positive().safeParse(id);
  if (!settlementId.success) return Response.json({ error: "Liquidación no encontrada" }, { status: 404 });

  const found = await loadSettlementWithReceipts(settlementId.data);
  if (!found) return Response.json({ error: "Liquidación no encontrada" }, { status: 404 });

  const file = await buildSettlementWorkbook(found.settlement, found.receipts);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename="liquidacion-${found.settlement.number}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
