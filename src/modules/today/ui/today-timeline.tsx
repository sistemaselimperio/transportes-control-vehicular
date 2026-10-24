"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/modules/dashboard/domain/dashboard-metrics";
import {
  ACTION_LABELS,
  KIND_LABELS,
  pillText,
  useAttentionAction,
} from "@/modules/alerts/ui/attention-actions";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { bucketByUrgency, URGENCY_ORDER, type Urgency } from "../domain/urgency";

const BLOCKS: Record<
  Urgency,
  { id: string; title: string; range: string; tone?: "danger"; empty: string }
> = {
  overdue: { id: "vencido", title: "Vencido", range: "ya pasó la fecha", tone: "danger", empty: "Nada vencido hoy." },
  week: { id: "esta-semana", title: "Esta semana", range: "hoy a 7 días", empty: "Nada vence en los próximos 7 días." },
  month: { id: "proximos-30", title: "Próximos 30 días", range: "8 a 30 días", empty: "Nada más por vencer en 30 días." },
};

/** Urgency blocks with a contextual quick action per row, opening a side panel. */
export function TodayTimeline({ items }: { items: AttentionItem[] }) {
  const buckets = bucketByUrgency(items);
  const action = useAttentionAction();

  return (
    <div className="space-y-5">
      {action.banner}

      {URGENCY_ORDER.map((urgency) => {
        const block = BLOCKS[urgency];
        const rows = buckets[urgency];
        return (
          <section key={urgency} id={block.id} aria-labelledby={`${block.id}-title`} className="panel scroll-mt-20">
            <div className="plate-head" data-tone={block.tone}>
              <h2 id={`${block.id}-title`} className="micro-label text-foreground">
                {block.title}
              </h2>
              <span className="micro-label">{block.range}</span>
              <span className="num ml-auto text-sm font-semibold">{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">{block.empty}</p>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <li
                    key={`${row.plate}:${row.kind}`}
                    data-active={action.isActive(row) ? "true" : undefined}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3 transition-colors duration-150 hover:bg-muted data-[active=true]:bg-secondary/70 md:grid-cols-[8rem_minmax(0,1fr)_auto_auto]"
                  >
                    <Link
                      href={`/flota/${encodeURIComponent(row.plate)}`}
                      aria-label={`Ver ficha de ${row.plate}`}
                      className="col-start-1 row-start-1 justify-self-start rounded-[5px] outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.97]"
                    >
                      <span className="plate">{row.plate}</span>
                    </Link>
                    <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                      <span className="block text-sm font-medium">{KIND_LABELS[row.kind]}</span>
                      <span className="num block truncate text-xs text-muted-foreground">{row.detail}</span>
                    </div>
                    <StatusPill
                      status={row.status}
                      className="col-start-2 row-start-1 justify-self-end md:col-start-3"
                    >
                      {pillText(row)}
                    </StatusPill>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`${ACTION_LABELS[row.kind]} ${KIND_LABELS[row.kind]} de ${row.plate}`}
                      className={cn(
                        "col-span-2 row-start-3 h-11 px-4 md:col-span-1 md:col-start-4 md:row-start-1 md:h-9",
                        row.status === "expired" && "border-danger-foreground/30",
                      )}
                      onClick={() => action.openFor(row)}
                    >
                      {ACTION_LABELS[row.kind]}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {action.panel}
    </div>
  );
}
