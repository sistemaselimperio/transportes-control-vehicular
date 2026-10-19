import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { listDriverRows } from "@/modules/drivers/application/driver-queries";
import { filterDriversByCompany } from "@/modules/drivers/domain/driver-row";
import { DriversView } from "@/modules/drivers/ui/drivers-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [rows, { grupo }] = await Promise.all([listDriverRows(), searchParams]);
  return <DriversView rows={filterDriversByCompany(rows, parseGroupParam(grupo))} />;
}
