import { receiptFiltersFromParams } from "@/modules/cotero-payments/application/export-filters";
import { coteroRouteGuard } from "@/modules/cotero-payments/application/route-guard";
import { filterReceipts } from "@/modules/cotero-payments/domain/receipt-rules";
import { loadReceiptRows } from "@/modules/cotero-payments/infrastructure/cotero-repository";
import { buildReceiptsWorkbook, XLSX_MIME } from "@/modules/cotero-payments/infrastructure/excel-exports";
import { todayInBogota } from "@/modules/shared/domain/dates";

/** The receipts of the current filters (the same query parameters the list uses) as an Excel file with totals. */
export async function GET(request: Request) {
  const denied = await coteroRouteGuard();
  if (denied) return denied;

  const filters = receiptFiltersFromParams(new URL(request.url).searchParams);
  const rows = filterReceipts(await loadReceiptRows(), filters);
  const file = await buildReceiptsWorkbook(rows);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename="recibos-coteros-${todayInBogota()}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
