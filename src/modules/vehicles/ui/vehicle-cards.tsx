import Link from "next/link";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import type { VehicleGridRow } from "../domain/vehicle-row";

/** Mobile list: one tappable card per vehicle (no horizontal scrolling). */
export function VehicleCards({ rows }: { rows: readonly VehicleGridRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/flota/${encodeURIComponent(r.plate)}`}
            className="block min-w-0 rounded-2xl border bg-card p-4 outline-none transition-[background-color,transform] duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1.5">
                <span className="plate">{r.plate}</span>
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
