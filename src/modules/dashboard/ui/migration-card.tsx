import type { MigrationProgress } from "../domain/dashboard-metrics";

export function MigrationCard({ migration }: { migration: MigrationProgress }) {
  const { total, imperio, percent, byOwner } = migration;
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-3xl font-semibold tabular-nums">{percent}%</span>
          <span className="text-sm text-muted-foreground">
            {imperio} de {total} vehículos
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Vehículos a nombre de Transportes El Imperio"
          className="mt-2 h-3 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {byOwner.map((o) => (
          <li key={o.ownerName} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{o.ownerName}</span>
            <span className="font-medium tabular-nums">{o.count}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Mide toda la flota sin vendidos; no depende del filtro de propietario.
      </p>
    </div>
  );
}
