import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardData } from "../application/dashboard-queries";
import { AttentionList } from "./attention-list";
import { FleetByClassChart, FleetByGroupChart, SoldByYearChart } from "./dashboard-charts";
import { KpiTiles } from "./kpi-tiles";
import { MigrationCard } from "./migration-card";
import { OwnerGroupFilter } from "./owner-group-filter";
import { PendingOilList } from "./pending-oil";

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Presentational dashboard: receives the already-aggregated data. */
export function DashboardView({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <OwnerGroupFilter active={data.group} />
      </div>

      <KpiTiles kpis={data.kpis} group={data.group} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Próximos vencimientos (30 días)">
          <AttentionList items={data.attention} group={data.group} />
        </Section>
        <Section title="Mantenimiento pendiente">
          <PendingOilList overdue={data.oil.overdue} dueSoon={data.oil.dueSoon} />
        </Section>
        <Section title="Flota por clase">
          <FleetByClassChart data={data.byClass} />
        </Section>
        <Section title="Flota por propietario">
          <FleetByGroupChart data={data.byGroup} />
        </Section>
        <Section title="Migración a Transportes El Imperio">
          <MigrationCard migration={data.migration} />
        </Section>
        <Section title="Vehículos vendidos por año">
          <SoldByYearChart data={data.soldByYear} />
        </Section>
      </div>
    </div>
  );
}
