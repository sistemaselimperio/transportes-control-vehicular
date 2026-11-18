import { notFound } from "next/navigation";
import { requireSectionAccess } from "@/lib/session";
import { getDailyReport } from "@/modules/inspections/infrastructure/inspection-repository";
import { DailyReportSheet } from "@/modules/inspections/ui/daily-report-sheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSectionAccess("inspections");
  const { id } = await params;
  // Anything that is not a UUID cannot exist; skip the query (Postgres would reject the cast).
  const report = UUID.test(id) ? await getDailyReport(id) : null;
  if (!report) notFound();
  return <DailyReportSheet report={report} />;
}
