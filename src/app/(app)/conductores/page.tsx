import { canWrite } from "@/lib/permissions";
import { requireSectionAccess } from "@/lib/session";
import { parseGroupParam } from "@/modules/dashboard/domain/dashboard-metrics";
import { listDriverRows } from "@/modules/drivers/application/driver-queries";
import { filterDriversByCompany } from "@/modules/drivers/domain/driver-row";
import { DriversView } from "@/modules/drivers/ui/drivers-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const role = await requireSectionAccess("drivers");
  // Await the request first: the cached read must run per request, never while prerendering.
  const { grupo } = await searchParams;
  const rows = await listDriverRows();
  return <DriversView rows={filterDriversByCompany(rows, parseGroupParam(grupo))} readOnly={!canWrite(role)} />;
}
