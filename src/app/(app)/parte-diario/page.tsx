import { PageHeader } from "@/components/app/page-header";
import { requireSectionAccess } from "@/lib/session";

/**
 * Left empty on purpose: the daily report data is still incomplete. `DailyReportView` and
 * `listDailyReports` stay in the inspections module to switch it back on later.
 */
export default async function Page() {
  await requireSectionAccess("inspections");
  return (
    <section className="space-y-5">
      <PageHeader title="Parte diario" />
    </section>
  );
}
