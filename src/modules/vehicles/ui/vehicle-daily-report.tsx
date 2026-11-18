import { ClipboardList } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { DailyReportRow } from "@/modules/inspections/domain/daily-report";
import { FuelValue } from "@/modules/inspections/ui/fuel-value";
import { formatBogotaDateTime } from "@/modules/inspections/ui/inspection-format";

const dash = (value: string | null) => value?.trim() || "—";

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-b py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** The vehicle's latest daily report, linked to its inspection; a muted note when it has none. */
export function VehicleDailyReport({ report }: { report: (DailyReportRow & { createdAt: Date }) | null }) {
  if (!report) {
    return (
      <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <ClipboardList className="size-4" aria-hidden />
        Sin partes diarios registrados.
      </p>
    );
  }
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b py-2.5 text-sm">
        <span className="num font-medium">{formatBogotaDateTime(report.createdAt)}</span>
        <span className="text-muted-foreground">{report.driverName}</span>
        <Link
          href={`/preoperacionales/${report.id}`}
          className="ml-auto inline-flex min-h-11 items-center text-muted-foreground underline decoration-muted-foreground/60 underline-offset-4 transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 md:min-h-7"
        >
          Ver preoperacional
        </Link>
      </p>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        <Item label="🏁 Km">
          <span className="num">{dash(report.odometer)}</span>
        </Item>
        <Item label="🕰️ Descanso">{dash(report.restHours)}</Item>
        <Item label="⛽ Combustible">
          <FuelValue fuel={report.fuel} />
        </Item>
        <Item label="🚏 Ruta">{dash(report.route)}</Item>
        <Item label="📍 Ubicación">{dash(report.location)}</Item>
        <Item label="🛠️ Mantenimiento">{dash(report.pendingMaintenance)}</Item>
      </dl>
    </div>
  );
}
