"use client";

import type { CSSProperties } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { OwnerGroup } from "../domain/dashboard-metrics";

/* Theme-aware series colors (light / dark). */
const BLUE = { light: "oklch(0.55 0.18 255)", dark: "oklch(0.72 0.14 255)" };
const GROUP_COLORS: Record<OwnerGroup | "NONE", { light: string; dark: string }> = {
  IMPERIO: BLUE,
  PAEZ: { light: "oklch(0.62 0.15 55)", dark: "oklch(0.78 0.13 70)" },
  THIRD_PARTY: { light: "oklch(0.55 0.13 165)", dark: "oklch(0.75 0.12 165)" },
  NONE: { light: "oklch(0.6 0 0)", dark: "oklch(0.65 0 0)" },
};

const countConfig = {
  count: { label: "Vehículos", theme: BLUE },
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
        <Bar dataKey="count" fill="var(--color-count)" radius={4} barSize={18}>
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
        <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={48}>
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
    data.map((d) => [d.group, { label: d.label, theme: GROUP_COLORS[d.group] }]),
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
              className="size-3 shrink-0 rounded-sm bg-(--sw-light) dark:bg-(--sw-dark)"
              style={
                {
                  "--sw-light": GROUP_COLORS[d.group].light,
                  "--sw-dark": GROUP_COLORS[d.group].dark,
                } as CSSProperties
              }
            />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="font-medium tabular-nums">{d.count}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">
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
