import type { MigrationProgress } from "../domain/dashboard-metrics";

export function MigrationCard({ migration }: { migration: MigrationProgress }) {
  const { total, imperio, percent, byOwner } = migration;
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="num text-3xl font-semibold tracking-tight">{percent}%</span>
          <span className="num text-sm text-muted-foreground">
            {imperio} de {total} vehículos
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Vehículos a nombre de Transportes El Imperio"
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {byOwner.map((o) => (
          <li key={o.ownerName} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{o.ownerName}</span>
            <span className="num font-medium">{o.count}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Mide toda la flota sin vendidos; no depende del filtro de propietario.
      </p>
    </div>
  );
}
