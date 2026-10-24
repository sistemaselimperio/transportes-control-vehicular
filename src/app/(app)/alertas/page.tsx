import { getDashboard } from "@/modules/dashboard/application/dashboard-queries";
import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { parseKindParam, parseStatusParam } from "@/modules/alerts/domain/alert-filters";
import { AlertsView } from "@/modules/alerts/ui/alerts-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { grupo, tipo, estado } = await searchParams;
  const data = await getDashboard(parseGroupParam(grupo));
  return (
    <AlertsView
      items={data.attention}
      group={data.group}
      initialKind={parseKindParam(tipo)}
      initialStatus={parseStatusParam(estado)}
    />
  );
}
