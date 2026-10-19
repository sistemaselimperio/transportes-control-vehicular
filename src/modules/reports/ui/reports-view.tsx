import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import type { DashboardData } from "@/modules/dashboard/application/dashboard-queries";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
import {
  FleetByClassChart,
  FleetByGroupChart,
  SoldByYearChart,
} from "@/modules/dashboard/ui/dashboard-charts";
import { MigrationCard } from "@/modules/dashboard/ui/migration-card";
import { ReportKpis } from "./report-kpis";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="plate-head">
        <h2 className="micro-label text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Reports: the fleet in numbers, away from the daily inbox. */
export function ReportsView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description={`La flota en cifras${data.group ? ` · ${GROUP_LABELS[data.group]}` : ""}.`}
      />

      <ReportKpis kpis={data.kpis} group={data.group} />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Block title="Flota por clase">
          <FleetByClassChart data={data.byClass} />
        </Block>
        <Block title="Flota por propietario">
          <FleetByGroupChart data={data.byGroup} />
        </Block>
        <Block title="Vehículos vendidos por año">
          <SoldByYearChart data={data.soldByYear} />
        </Block>
        <Block title="Migración a Transportes El Imperio">
          <MigrationCard migration={data.migration} />
        </Block>
      </div>
    </div>
  );
}
