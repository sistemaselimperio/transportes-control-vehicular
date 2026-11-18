import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PlateText } from "@/components/app/plate-text";
import type { DailyReportRow } from "../domain/daily-report";
import { DailyReportDateForm } from "./daily-report-date-form";
import { formatInspectionDate } from "./inspection-format";
import { FuelValue } from "./fuel-value";

const dash = (value: string | null) => value?.trim() || "—";

const COLUMNS = [
  "Placa",
  "Conductor",
  "Km",
  "Descanso",
  "Ruta",
  "Ubicación",
  "Combustible",
  "Mantenimiento",
];

const LINK = "outline-none focus-visible:ring-2 focus-visible:ring-ring/70";

/** Link that stretches over its whole row / card (positioned ancestor): opens the report detail. */
const ROW_LINK =
  "outline-none after:absolute after:inset-0 after:rounded-[inherit]";

/**
 * The plate opens the vehicle in Flota when it matches a registered vehicle. It sits above the
 * row's stretched link (`relative z-10`) so both stay clickable without nesting links.
 */
function Plate({ row }: { row: DailyReportRow }) {
  if (!row.vehiclePlate) {
    return (
      <span className="plate">
        <PlateText plate={row.plate} />
      </span>
    );
  }
  return (
    <Link
      href={`/flota/${encodeURIComponent(row.vehiclePlate)}`}
      className={`${LINK} plate relative z-10 hover:opacity-80`}
    >
      <PlateText plate={row.plate} />
    </Link>
  );
}

/** Office page: the latest daily report of each plate that reported on the chosen date. */
export function DailyReportView({
  rows,
  date,
}: {
  rows: readonly DailyReportRow[];
  date: string;
}) {
  return (
    <section className="space-y-5">
      <PageHeader
        title="Parte diario"
        description="Último parte de cada vehículo que reportó en la fecha elegida. Se muestran los registrados desde el 18/11/2026 a las 3:00 p. m."
        actions={<DailyReportDateForm date={date} />}
      />

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="size-4" aria-hidden />
          No hay partes diarios para esta fecha.
        </p>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className="relative space-y-3 rounded-2xl border bg-card p-4 hover:bg-muted/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <Plate row={r} />
                  <FuelValue fuel={r.fuel} />
                </div>
                <p className="font-medium">
                  <Link href={`/parte-diario/${r.id}`} className={ROW_LINK}>
                    {r.driverName}
                  </Link>
                </p>
                <dl className="grid gap-2 text-sm">
                  <Item label="🕰️ Descanso" value={dash(r.restHours)} />
                  <Item label="🏁 Km" value={dash(r.odometer)} />
                  <Item label="🚏 Ruta" value={dash(r.route)} />
                  <Item label="📍 Ubicación" value={dash(r.location)} />
                  <Item
                    label="🛠️ Mantenimiento"
                    value={dash(r.pendingMaintenance)}
                  />
                </dl>
              </li>
            ))}
          </ul>

          <div className="panel hidden md:block">
            <div className="plate-head">
              <span className="micro-label">
                {rows.length} {rows.length === 1 ? "vehículo" : "vehículos"} ·{" "}
                {formatInspectionDate(date)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b">
                    {COLUMNS.map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="micro-label px-4 py-3 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="relative hover:bg-muted/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/70 has-[a:focus-visible]:ring-inset"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Plate row={r} />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/parte-diario/${r.id}`}
                          className={ROW_LINK}
                        >
                          {r.driverName}
                        </Link>
                      </td>
                      <td className="num px-4 py-3 whitespace-nowrap">
                        {dash(r.odometer)}
                      </td>
                      <td className="px-4 py-3">{dash(r.restHours)}</td>
                      <td className="px-4 py-3">{dash(r.route)}</td>
                      <td className="px-4 py-3">{dash(r.location)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <FuelValue fuel={r.fuel} />
                      </td>
                      <td className="px-4 py-3">
                        {dash(r.pendingMaintenance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
