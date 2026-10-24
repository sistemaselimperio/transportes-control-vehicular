import {
  parseKindParam,
  parseQueryParam,
  parseStatusParam,
} from "@/modules/alerts/domain/alert-filters";
import { getDashboard } from "@/modules/dashboard/application/dashboard-queries";
import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { TodayView } from "@/modules/today/ui/today-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { grupo, tipo, estado, placa } = await searchParams;
  const data = await getDashboard(parseGroupParam(grupo));
  return (
    <TodayView
      data={data}
      initialKind={parseKindParam(tipo)}
      initialStatus={parseStatusParam(estado)}
      initialQuery={parseQueryParam(placa)}
    />
  );
}
