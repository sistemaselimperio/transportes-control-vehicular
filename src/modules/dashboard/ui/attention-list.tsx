import Link from "next/link";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import type { AttentionItem, ItemKind, OwnerGroup } from "../domain/dashboard-metrics";

const KIND_LABELS: Record<ItemKind, string> = {
  SOAT: "SOAT",
  TECNO: "Tecnomecánica",
  POLICY: "Póliza",
  TAX: "Impuesto",
  OIL: "Cambio de aceite",
};

const LIMIT = 12;

function when(item: AttentionItem): string {
  if (item.daysLeft === null) return item.detail;
  if (item.daysLeft < 0) {
    const d = -item.daysLeft;
    return `${item.detail} · hace ${d} día${d === 1 ? "" : "s"}`;
  }
  if (item.daysLeft === 0) return `${item.detail} · hoy`;
  return `${item.detail} · en ${item.daysLeft} día${item.daysLeft === 1 ? "" : "s"}`;
}

export function AttentionList({
  items,
  group,
}: {
  items: AttentionItem[];
  group: OwnerGroup | null;
}) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Nada vencido ni por vencer en los próximos 30 días.</p>;
  }
  const shown = items.slice(0, LIMIT);
  const rest = items.length - shown.length;
  const moreHref = group ? `/vehiculos?alertas=1&grupo=${group}` : "/vehiculos?alertas=1";

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">
        {shown.map((item) => (
          <li key={`${item.plate}:${item.kind}`}>
            <Link
              href={`/vehiculos/${encodeURIComponent(item.plate)}`}
              className="flex min-h-12 items-center justify-between gap-2 px-3 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0">
                <span className="block font-mono font-semibold">{item.plate}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {KIND_LABELS[item.kind]}
                </span>
              </span>
              <StatusPill status={item.status}>{when(item)}</StatusPill>
            </Link>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <Link href={moreHref} className="inline-block text-sm font-medium underline underline-offset-4">
          Ver {rest} más en Vehículos
        </Link>
      )}
    </div>
  );
}
