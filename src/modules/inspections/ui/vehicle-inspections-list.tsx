import Link from "next/link";
import type { VehicleInspectionRow } from "../infrastructure/inspection-repository";
import { exitStatus } from "../domain/exit-decision";
import { ExitBadge, StatusBadge } from "./inspection-badges";
import { formatInspectionDate } from "./inspection-format";

/** Latest inspections of one vehicle for its file; the caller wraps it in the file's section. */
export function VehicleInspectionsList({ vehicleId, rows, limit }: { vehicleId: number; rows: readonly VehicleInspectionRow[]; limit: number }) {
  if (rows.length === 0) {
    return <p className="border-b py-2.5 text-sm text-muted-foreground">Sin inspecciones preoperacionales enlazadas a este vehículo.</p>;
  }
  return (
    <>
      <ul>
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
      {rows.length >= limit && (
        <p className="pt-2.5 text-sm">
          <Link
            href={`/preoperacionales?vehiculo=${vehicleId}`}
            className="underline-offset-2 hover:underline"
          >
            Ver todas en Preoperacionales
          </Link>
        </p>
      )}
    </>
  );
}
