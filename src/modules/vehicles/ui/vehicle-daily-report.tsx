import Link from "next/link";
import type { DailyReportRow } from "@/modules/inspections/domain/daily-report";
import { FuelValue } from "@/modules/inspections/ui/fuel-value";
import { formatBogotaDateTime } from "@/modules/inspections/ui/inspection-format";

const dash = (value: string | null) => value?.trim() || "—";

const TH = "micro-label px-4 py-3 font-medium";
const TD = "px-4 py-3";

type Report = DailyReportRow & { createdAt: Date };

/**
 * Latest daily reports of one vehicle for the Historial tab, newest first. Same layout as the
 * Preoperacionales tab: from `md` a table whose date links to the inspection with a hit area over
 * the whole row; ruled links on phones.
 */
export function VehicleDailyReports({ reports }: { reports: readonly Report[] }) {
  if (reports.length === 0) {
    return <p className="border-b py-2.5 text-sm text-muted-foreground">Sin partes diarios registrados.</p>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto border-b md:block">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              {["Fecha", "Conductor", "Km", "Descanso", "Ruta", "Ubicación", "Combustible", "Mantenimiento"].map((h) => (
                <th key={h} scope="col" className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {reports.map((r) => (
              <tr
                key={r.id}
                className="relative hover:bg-muted/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/70 has-[a:focus-visible]:ring-inset"
              >
                <td className={`${TD} num whitespace-nowrap`}>
                  <Link href={`/preoperacionales/${r.id}`} className="outline-none after:absolute after:inset-0">
                    {formatBogotaDateTime(r.createdAt)}
                  </Link>
                </td>
                <td className={`${TD} font-medium`}>{r.driverName}</td>
                <td className={`${TD} num whitespace-nowrap`}>{dash(r.odometer)}</td>
                <td className={TD}>{dash(r.restHours)}</td>
                <td className={TD}>{dash(r.route)}</td>
                <td className={TD}>{dash(r.location)}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  <FuelValue fuel={r.fuel} />
                </td>
                <td className={TD}>{dash(r.pendingMaintenance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden">
        {reports.map((r) => (
          <li key={r.id} className="border-b">
            <Link
              href={`/preoperacionales/${r.id}`}
              className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <span className="num whitespace-nowrap">{formatBogotaDateTime(r.createdAt)}</span>
              <span className="min-w-0 flex-1 basis-40 truncate font-medium">{r.driverName}</span>
              <span className="text-muted-foreground">📍 {dash(r.location)}</span>
              <FuelValue fuel={r.fuel} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
