import Link from "next/link";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { technicalProgress } from "../domain/technical-data";
import { ProgressBadge } from "./progress-badge";
import { isTrailerClass } from "../domain/trailer";
import type { VehicleGridRow } from "../domain/vehicle-row";
import { PlateText } from "@/components/app/plate-text";
import type { FleetSelection } from "./vehicle-table";

/** Mobile list: one tappable card per vehicle (no horizontal scrolling). */
export function VehicleCards({
  rows,
  selection,
}: {
  rows: readonly VehicleGridRow[];
  selection?: FleetSelection;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.id} className={selection ? "flex items-stretch gap-2" : undefined}>
          {selection && (
            <label className="flex w-8 shrink-0 items-start justify-center pt-5">
              <span className="sr-only">Seleccionar {r.plate}</span>
              <input
                type="checkbox"
                className="size-5 cursor-pointer disabled:cursor-not-allowed"
                checked={selection.selected.has(r.plate)}
                disabled={r.vehicleStatus === "SOLD"}
                onChange={() => selection.onToggle(r.plate)}
              />
            </label>
          )}
          <Link
            href={`/flota/${encodeURIComponent(r.plate)}`}
            className="block min-w-0 flex-1 rounded-2xl border bg-card p-4 outline-none transition-[background-color,transform] duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1.5">
                <span className="plate"><PlateText plate={r.plate} /></span>
                <div className="truncate text-sm text-muted-foreground">
                  {[r.className, r.brandLine].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusPill status={r.overall}>{r.statusLabel}</StatusPill>
            </div>
            <div className="mt-2 truncate text-sm">
              {r.ownerName ?? "Sin propietario"}
              {r.driverName ? ` · ${r.driverName}` : ""}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
              <StatusPill status={r.soat.status} muted={r.silenced}>SOAT {r.soat.text || "—"}</StatusPill>
              <StatusPill status={r.tecno.status} muted={r.silenced}>Tecno {r.tecno.text || "—"}</StatusPill>
              <StatusPill status={r.policy.status} muted={r.silenced}>Póliza {r.policy.text || "—"}</StatusPill>
              <StatusPill status={r.tax.status} muted={r.silenced}>Imp. {r.tax.text || "—"}</StatusPill>
              {!isTrailerClass(r.className) && (
                <StatusPill status={r.nextChange.status} muted={r.silenced}>
                  Aceite {r.nextChange.text || "—"}
                </StatusPill>
              )}
              <ProgressBadge subject="Datos técnicos" prefix="Téc." progress={technicalProgress(r.technical)} />
              <ProgressBadge subject="Documentos subidos" prefix="Docs" progress={r.files} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
