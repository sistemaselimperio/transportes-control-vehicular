import { ArrowLeft, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { PlateText } from "@/components/app/plate-text";
import { buttonVariants } from "@/components/ui/button";
import type { DailyReportRow } from "../domain/daily-report";
import { FuelValue } from "./fuel-value";
import { formatBogotaDateTime } from "./inspection-format";

const dash = (value: string | null) => value?.trim() || "—";

type Report = DailyReportRow & { createdAt: Date; inspectionDate: string };

/** One daily report as a form-like sheet, with the way back to its day and to its preoperational. */
export function DailyReportSheet({ report }: { report: Report }) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Conductor", value: dash(report.driverName) },
    { label: "Fecha y hora", value: formatBogotaDateTime(report.createdAt) },
    { label: "Km", value: dash(report.odometer) },
    { label: "Descanso", value: dash(report.restHours) },
    { label: "Ruta", value: dash(report.route) },
    { label: "Ubicación", value: dash(report.location) },
    { label: "Combustible", value: <FuelValue fuel={report.fuel} /> },
    { label: "Mantenimiento", value: dash(report.pendingMaintenance) },
  ];
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/parte-diario?fecha=${report.inspectionDate}`}
          className={buttonVariants({ variant: "ghost", className: "h-11 px-3 md:h-10" })}
        >
          <ArrowLeft aria-hidden />
          Parte diario
        </Link>
        <Link
          href={`/preoperacionales/${report.id}`}
          className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-10" })}
        >
          <ClipboardCheck aria-hidden />
          Ver preoperacional
        </Link>
      </div>

      <section
        aria-labelledby="daily-report-title"
        className="mx-auto w-full max-w-3xl space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-8"
      >
        <h1 id="daily-report-title" className="flex flex-wrap items-baseline gap-x-3 border-b-2 pb-2 text-xl font-bold">
          <span>Parte diario —</span>
          <span className="plate">
            <PlateText plate={report.plate} />
          </span>
          {report.trailerPlate && (
            <span className="text-base font-medium text-muted-foreground">
              Remolque <PlateText plate={report.trailerPlate} />
            </span>
          )}
        </h1>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="space-y-1 border-b pb-2">
              <dt className="micro-label">{f.label}</dt>
              <dd className="font-medium break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
