import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Kpis, OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";

interface Cell {
  label: string;
  value: number;
  hint: string;
  vista: string;
}

function buildCells(k: Kpis): Cell[] {
  return [
    { label: "Flota activa", value: k.activeFleet, hint: `${k.fleetTotal} sin contar vendidos`, vista: "activos" },
    { label: "En taller", value: k.inWorkshop, hint: "vehículos", vista: "taller" },
    { label: "Quietas", value: k.idle, hint: "vehículos", vista: "quietas" },
    { label: "Vendidos este año", value: k.soldThisYear, hint: "vehículos", vista: "vendidos" },
  ];
}

/** One container split by hairlines; each cell opens the matching fleet view. */
export function ReportKpis({ kpis, group }: { kpis: Kpis; group: OwnerGroup | null }) {
  return (
    <ul className="panel grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
      {buildCells(kpis).map((c) => {
        const params = new URLSearchParams({ vista: c.vista });
        if (group) params.set("grupo", group);
        return (
          <li key={c.label} className="bg-card">
            <Link
              href={`/flota?${params}`}
              className="group/kpi block h-full px-4 py-4 outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset sm:px-5"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="micro-label">{c.label}</span>
                <ArrowUpRight
                  className="size-4 text-muted-foreground transition-transform duration-150 group-hover/kpi:translate-x-0.5 group-hover/kpi:-translate-y-0.5"
                  aria-hidden
                />
              </span>
              <span className="num mt-2 block text-4xl leading-none font-semibold">{c.value}</span>
              <span className="mt-1.5 block text-xs text-muted-foreground">{c.hint}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
