import Link from "next/link";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import type { PendingOil } from "../domain/dashboard-metrics";

const LIMIT = 8;

export function PendingOilList({
  overdue,
  dueSoon,
}: {
  overdue: PendingOil[];
  dueSoon: PendingOil[];
}) {
  if (overdue.length + dueSoon.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No hay cambios de aceite pendientes.</p>;
  }
  return (
    <div className="space-y-4">
      <Group title="Vencidos" items={overdue} />
      <Group title="Próximos a vencer" items={dueSoon} />
    </div>
  );
}

function Group({ title, items }: { title: string; items: PendingOil[] }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, LIMIT);
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground tabular-nums">({items.length})</span>
      </h3>
      <ul className="divide-y rounded-lg border">
        {shown.map((p) => (
          <li key={p.plate}>
            <Link
              href={`/vehiculos/${encodeURIComponent(p.plate)}`}
              className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="font-mono font-semibold">{p.plate}</span>
              <StatusPill status={p.status}>{p.detail}</StatusPill>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > shown.length && (
        <p className="text-xs text-muted-foreground">y {items.length - shown.length} más</p>
      )}
    </div>
  );
}
