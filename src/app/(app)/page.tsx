import { getDashboard } from "@/modules/dashboard/application/dashboard-queries";
import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { DashboardView } from "@/modules/dashboard/ui/dashboard-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { grupo } = await searchParams;
  const data = await getDashboard(parseGroupParam(grupo));
  return <DashboardView data={data} />;
}
