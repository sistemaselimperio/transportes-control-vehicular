import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { listSaleRows } from "@/modules/sales/application/sale-queries";
import { filterSalesByGroup, parseYearParam } from "@/modules/sales/domain/sale-row";
import { SalesView } from "@/modules/sales/ui/sales-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Await the request first: the cached read must run per request, never while prerendering.
  const { grupo, anio } = await searchParams;
  const rows = await listSaleRows();
  const group = parseGroupParam(grupo);
  return <SalesView rows={filterSalesByGroup(rows, group)} group={group} initialYear={parseYearParam(anio)} />;
}
