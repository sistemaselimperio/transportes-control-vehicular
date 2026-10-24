import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { listSaleRows } from "@/modules/sales/application/sale-queries";
import { filterSalesByGroup, parseYearParam } from "@/modules/sales/domain/sale-row";
import { SalesView } from "@/modules/sales/ui/sales-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [rows, { grupo, anio }] = await Promise.all([listSaleRows(), searchParams]);
  const group = parseGroupParam(grupo);
  return <SalesView rows={filterSalesByGroup(rows, group)} group={group} initialYear={parseYearParam(anio)} />;
}
