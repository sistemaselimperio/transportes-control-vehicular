import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Kpis, OwnerGroup } from "../domain/dashboard-metrics";

type Tone = "neutral" | "danger" | "warning";

const TONES: Record<Tone, string> = {
  neutral: "bg-card",
  danger: "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100",
  warning:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100",
};

interface Tile {
  label: string;
  value: number;
  hint: string;
  tone: Tone;
  /** Query for /vehiculos (without the owner group). */
  query: Record<string, string>;
}

function buildTiles(k: Kpis): Tile[] {
  return [
    {
      label: "Flota activa",
      value: k.activeFleet,
      hint: `${k.fleetTotal} sin contar vendidos`,
      tone: "neutral",
      query: { estado: "ACTIVE" },
    },
    {
      label: "Vencidos",
      value: k.expiredItems,
      hint: `en ${k.expiredVehicles} vehículo${k.expiredVehicles === 1 ? "" : "s"}`,
      tone: "danger",
      query: { alertas: "1" },
    },
    {
      label: "Por vencer",
      value: k.warningItems,
      hint: `en ${k.warningVehicles} vehículo${k.warningVehicles === 1 ? "" : "s"}`,
      tone: "warning",
      query: { alertas: "1" },
    },
    { label: "En taller", value: k.inWorkshop, hint: "vehículos", tone: "neutral", query: { estado: "IN_WORKSHOP" } },
    { label: "Quietas", value: k.idle, hint: "vehículos", tone: "neutral", query: { estado: "IDLE" } },
    { label: "Vendidos este año", value: k.soldThisYear, hint: "vehículos", tone: "neutral", query: { estado: "SOLD" } },
  ];
}

export function KpiTiles({ kpis, group }: { kpis: Kpis; group: OwnerGroup | null }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {buildTiles(kpis).map((t) => {
        const params = new URLSearchParams(t.query);
        if (group) params.set("grupo", group);
        return (
          <li key={t.label}>
            <Link
              href={`/vehiculos?${params}`}
              className={cn(
                "block h-full rounded-xl border p-3 outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50",
                TONES[t.tone],
              )}
            >
              <div className="text-sm">{t.label}</div>
              <div className="mt-1 text-3xl leading-none font-semibold tabular-nums">{t.value}</div>
              <div className="mt-1 text-xs opacity-80">{t.hint}</div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
