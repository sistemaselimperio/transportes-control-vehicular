import { requireSectionAccess } from "@/lib/session";
import { parseDailyReportDate } from "@/modules/inspections/domain/daily-report";
import { bogotaDateTime } from "@/modules/inspections/domain/preoperational-inspection";
import { listDailyReports } from "@/modules/inspections/infrastructure/inspection-repository";
import { DailyReportView } from "@/modules/inspections/ui/daily-report-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSectionAccess("inspections");
  const date = parseDailyReportDate((await searchParams).fecha, bogotaDateTime(new Date()).date);
  const rows = await listDailyReports(date);
  return <DailyReportView rows={rows} date={date} />;
}
