import { getDashboard } from "@/modules/dashboard/application/dashboard-queries";
import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { ReportsView } from "@/modules/reports/ui/reports-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { grupo } = await searchParams;
  const data = await getDashboard(parseGroupParam(grupo));
  return <ReportsView data={data} />;
}
