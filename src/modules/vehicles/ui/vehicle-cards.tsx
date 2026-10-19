import Link from "next/link";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import type { VehicleGridRow } from "../domain/vehicle-row";

/** Mobile list: one tappable card per vehicle (no horizontal scrolling). */
export function VehicleCards({ rows }: { rows: readonly VehicleGridRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/vehiculos/${encodeURIComponent(r.plate)}`}
            className="block min-w-0 rounded-lg border bg-card p-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-lg leading-tight font-semibold">{r.plate}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {[r.className, r.brandLine].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusPill status={r.overall}>{r.statusLabel}</StatusPill>
            </div>
            <div className="mt-1.5 truncate text-sm">
              {r.ownerName ?? "Sin propietario"}
              {r.driverName ? ` · ${r.driverName}` : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusPill status={r.soat.status}>SOAT {r.soat.text || "—"}</StatusPill>
              <StatusPill status={r.tecno.status}>Tecno {r.tecno.text || "—"}</StatusPill>
              <StatusPill status={r.policy.status}>Póliza {r.policy.text || "—"}</StatusPill>
              <StatusPill status={r.tax.status}>Imp. {r.tax.text || "—"}</StatusPill>
              <StatusPill status={r.nextChange.status}>
                Aceite {r.nextChange.text || "—"}
              </StatusPill>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
