import Link from "next/link";
import type { VehicleInspectionRow } from "../infrastructure/inspection-repository";
import { exitStatus } from "../domain/exit-decision";
import { ExitBadge, StatusBadge } from "./inspection-badges";
import { formatInspectionDate } from "./inspection-format";

const TH = "micro-label px-4 py-3 font-medium";
const TD = "px-4 py-3";

/**
 * Latest inspections of one vehicle for its file; the caller wraps it in the file's section.
 * From `md` a table with headers, like the Bitácora lists (the date links to the inspection and its
 * hit area covers the whole row); ruled links on phones. The link to the full list sits next to
 * the Historial tabs.
 */
export function VehicleInspectionsList({ rows }: { rows: readonly VehicleInspectionRow[] }) {
  if (rows.length === 0) {
    return <p className="border-b py-2.5 text-sm text-muted-foreground">Sin inspecciones preoperacionales enlazadas a este vehículo.</p>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto border-b md:block">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th scope="col" className={TH}>Fecha</th>
              <th scope="col" className={TH}>Conductor</th>
              <th scope="col" className={TH}>Resultado</th>
              <th scope="col" className={TH}>Salida</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="relative hover:bg-muted/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/70 has-[a:focus-visible]:ring-inset">
                <td className={`${TD} num whitespace-nowrap`}>
                  <Link href={`/preoperacionales/${r.id}`} className="outline-none after:absolute after:inset-0">
                    {formatInspectionDate(r.inspectionDate)} {r.inspectionTime}
                  </Link>
                </td>
                <td className={`${TD} font-medium`}>
                  {r.driverName}
                  {r.asTrailer && <span className="ml-2 text-xs font-normal text-muted-foreground">Como remolque</span>}
                </td>
                <td className={TD}>
                  <StatusBadge critical={r.hasCriticalFailure} />
                </td>
                <td className={TD}>
                  <ExitBadge status={exitStatus(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="border-b">
            <Link
              href={`/preoperacionales/${r.id}`}
              className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <span className="num whitespace-nowrap">
                {formatInspectionDate(r.inspectionDate)} {r.inspectionTime}
              </span>
              <span className="min-w-0 flex-1 basis-40 truncate font-medium">{r.driverName}</span>
              {r.asTrailer && <span className="text-xs text-muted-foreground">Como remolque</span>}
              <StatusBadge critical={r.hasCriticalFailure} />
              <ExitBadge status={exitStatus(r)} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
