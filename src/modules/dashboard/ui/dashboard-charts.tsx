"use client";

import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { OwnerGroup } from "../domain/dashboard-metrics";

/* Series colors come from the theme tokens: amber is the main data hue, rose the second. */
const ACCENT = "var(--chart-1)";
const GROUP_COLORS: Record<OwnerGroup | "NONE", string> = {
  IMPERIO: "var(--chart-1)",
  PAEZ: "var(--chart-2)",
  THIRD_PARTY: "var(--chart-3)",
  NONE: "var(--chart-5)",
};

const countConfig = {
  count: { label: "Vehículos", color: ACCENT },
} satisfies ChartConfig;

const ROW_HEIGHT = 34;

/** Horizontal bars: readable on a 360px phone because labels sit on the left. */
export function FleetByClassChart({ data }: { data: Array<{ name: string; count: number }> }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ChartContainer
      config={countConfig}
      className="aspect-auto w-full"
      style={{ height: data.length * ROW_HEIGHT + 16 }}
      role="img"
      aria-label={`Flota por clase: ${data.map((d) => `${d.name} ${d.count}`).join(", ")}`}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 28, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function SoldByYearChart({ data }: { data: Array<{ year: string; count: number }> }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ChartContainer
      config={countConfig}
      className="aspect-auto h-52 w-full"
      role="img"
      aria-label={`Vehículos vendidos por año: ${data.map((d) => `${d.year} ${d.count}`).join(", ")}`}
    >
      <BarChart data={data} margin={{ top: 18, left: 0, right: 0, bottom: 0 }}>
        <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="count" position="top" className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function FleetByGroupChart({
  data,
}: {
  data: Array<{ group: OwnerGroup | "NONE"; label: string; count: number }>;
}) {
  if (data.length === 0) return <EmptyChart />;
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.group, { label: d.label, color: GROUP_COLORS[d.group] }]),
  );
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
      <ChartContainer
        config={config}
        className="aspect-square h-44 w-44 shrink-0"
        role="img"
        aria-label={`Flota por propietario: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}
      >
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="group" />} />
          <Pie data={data} dataKey="count" nameKey="group" innerRadius={50} strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.group} fill={`var(--color-${d.group})`} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.group} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-[3px] border border-foreground/10"
              style={{ backgroundColor: GROUP_COLORS[d.group] }}
            />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="num font-medium">{d.count}</span>
            <span className="num w-10 text-right text-muted-foreground">
              {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChart() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para mostrar.</p>;
}
