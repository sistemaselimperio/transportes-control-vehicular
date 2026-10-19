import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/modules/dashboard/application/dashboard-queries";
import { GROUP_LABELS, type OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";
import { TodayTimeline } from "./today-timeline";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function longDate(iso: string): string {
  // Noon UTC keeps the calendar day stable whatever the server timezone.
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

function fleetHref(vista: string, group: OwnerGroup | null) {
  const params = new URLSearchParams({ vista });
  if (group) params.set("grupo", group);
  return `/flota?${params}`;
}

function Counter({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "danger" | "warn";
  href: string;
}) {
  return (
    <a
      href={href}
      className="group/counter block px-4 py-4 outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset sm:px-5"
    >
      <span className="micro-label block">{label}</span>
      <span
        className={cn(
          "num mt-2 block text-4xl leading-none font-semibold",
          tone === "danger" && value > 0 && "text-danger-foreground",
          tone === "warn" && value > 0 && "text-warn-foreground",
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>
    </a>
  );
}

/** "Hoy": what needs attention, in the order it needs it. */
export function TodayView({ data }: { data: DashboardData }) {
  const { kpis, group } = data;
  const finding =
    kpis.expiredItems === 0
      ? kpis.warningItems === 0
        ? "Nada vencido ni por vencer en los próximos 30 días."
        : `Nada vencido hoy. ${plural(kpis.warningItems, "pendiente por vencer", "pendientes por vencer")}.`
      : `${plural(kpis.expiredItems, "vencido", "vencidos")} en ${plural(kpis.expiredVehicles, "vehículo", "vehículos")}.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hoy"
        description={
          <>
            <span className="first-letter:uppercase">{longDate(data.today)}</span>
            {group ? ` · ${GROUP_LABELS[group]}` : ""}
          </>
        }
      />

      <div className="panel grid grid-cols-2 divide-x">
        <Counter
          label="Vencidos"
          value={kpis.expiredItems}
          hint={`en ${plural(kpis.expiredVehicles, "vehículo", "vehículos")}`}
          tone="danger"
          href="#vencido"
        />
        <Counter
          label="Por vencer"
          value={kpis.warningItems}
          hint={`en ${plural(kpis.warningVehicles, "vehículo", "vehículos")} · 30 días`}
          tone="warn"
          href="#esta-semana"
        />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">{finding}</p>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <TodayTimeline items={data.attention} />

        <aside aria-labelledby="fuera-de-ruta" className="panel xl:sticky xl:top-8">
          <div className="plate-head" data-tone="rose">
            <h2 id="fuera-de-ruta" className="micro-label text-foreground">
              Fuera de ruta
            </h2>
          </div>
          <ul className="divide-y">
            {[
              { label: "En taller", value: kpis.inWorkshop, vista: "taller" },
              { label: "Quietas", value: kpis.idle, vista: "quietas" },
            ].map((row) => (
              <li key={row.vista}>
                <Link
                  href={fleetHref(row.vista, group)}
                  className="group/link flex min-h-14 items-center justify-between gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
                >
                  <span className="text-sm">{row.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="num text-xl font-semibold">{row.value}</span>
                    <ArrowUpRight
                      className="size-4 text-muted-foreground transition-transform duration-150 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={fleetHref("alertas", group)}
            className="flex min-h-12 items-center justify-between gap-2 border-t px-4 text-sm font-medium outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
          >
            Ver flota con alertas
            <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
