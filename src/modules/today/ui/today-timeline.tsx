"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttentionItem, ItemKind } from "@/modules/dashboard/domain/dashboard-metrics";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { loadActionContextAction } from "@/modules/vehicles/application/vehicle-actions";
import type { VehicleActionContext } from "@/modules/vehicles/application/vehicle-queries";
import {
  OilChangeForm,
  RenewDocumentForm,
  UpdateTaxForm,
  type DocumentType,
} from "@/modules/vehicles/ui/vehicle-action-forms";
import {
  bucketByUrgency,
  describeDaysLeft,
  URGENCY_ORDER,
  type Urgency,
} from "../domain/urgency";

const KIND_LABELS: Record<ItemKind, string> = {
  SOAT: "SOAT",
  TECNO: "Tecnomecánica",
  POLICY: "Póliza",
  TAX: "Impuesto",
  OIL: "Cambio de aceite",
};

const ACTION_LABELS: Record<ItemKind, string> = {
  SOAT: "Renovar",
  TECNO: "Renovar",
  POLICY: "Renovar",
  TAX: "Actualizar",
  OIL: "Registrar cambio",
};

const PANEL_TITLES: Record<ItemKind, string> = {
  SOAT: "Renovar SOAT",
  TECNO: "Renovar tecnomecánica",
  POLICY: "Renovar póliza",
  TAX: "Actualizar impuesto",
  OIL: "Registrar cambio de aceite",
};

const BLOCKS: Record<
  Urgency,
  { id: string; title: string; range: string; tone?: "danger"; empty: string }
> = {
  overdue: { id: "vencido", title: "Vencido", range: "ya pasó la fecha", tone: "danger", empty: "Nada vencido hoy." },
  week: { id: "esta-semana", title: "Esta semana", range: "hoy a 7 días", empty: "Nada vence en los próximos 7 días." },
  month: { id: "proximos-30", title: "Próximos 30 días", range: "8 a 30 días", empty: "Nada más por vencer en 30 días." },
};

const isDocument = (kind: ItemKind): kind is DocumentType =>
  kind === "SOAT" || kind === "TECNO" || kind === "POLICY";

interface Active {
  item: AttentionItem;
  ctx: VehicleActionContext | null;
  failed: boolean;
}

function pillText(item: AttentionItem): string {
  if (item.daysLeft !== null) return describeDaysLeft(item.daysLeft);
  return item.status === "expired" ? "Vencido" : "Por vencer";
}

/** Urgency blocks with a contextual quick action per row, opening a side panel. */
export function TodayTimeline({ items }: { items: AttentionItem[] }) {
  const buckets = bucketByUrgency(items);
  const [active, setActive] = useState<Active | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function fetchContext(item: AttentionItem) {
    loadActionContextAction(item.plate).then((ctx) =>
      setActive((a) => (a && a.item === item ? { item, ctx, failed: ctx === null } : a)),
    );
  }

  function openFor(item: AttentionItem) {
    setMessage(null);
    setActive({ item, ctx: null, failed: false });
    setOpen(true);
    if (!isDocument(item.kind)) fetchContext(item);
  }

  function done(msg: string) {
    setOpen(false);
    setMessage(msg);
    setTimeout(() => setMessage(null), 6000);
  }

  const close = () => setOpen(false);
  const item = active?.item;

  return (
    <div className="space-y-5">
      {message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

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
                    data-active={open && active?.item === row ? "true" : undefined}
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
                      onClick={() => openFor(row)}
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

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={item ? PANEL_TITLES[item.kind] : ""}
        description={item ? `Vehículo ${item.plate}` : undefined}
      >
        {item && isDocument(item.kind) && (
          <RenewDocumentForm
            plate={item.plate}
            initialType={item.kind}
            onDone={done}
            onCancel={close}
          />
        )}
        {item && !isDocument(item.kind) && active && (
          <ContextForm active={active} onDone={done} onCancel={close} onRetry={() => {
            setActive({ item: active.item, ctx: null, failed: false });
            fetchContext(active.item);
          }} />
        )}
      </SlideOver>
    </div>
  );
}

function ContextForm({
  active,
  onDone,
  onCancel,
  onRetry,
}: {
  active: Active;
  onDone: (message: string) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (active.failed) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          No se pudieron cargar los datos del vehículo.
        </p>
        <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!active.ctx) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando datos del vehículo">
        <div className="skeleton h-9 w-full" />
        <div className="skeleton h-9 w-2/3" />
        <div className="skeleton h-9 w-full" />
      </div>
    );
  }
  const common = { plate: active.item.plate, ctx: active.ctx, onDone, onCancel };
  return active.item.kind === "TAX" ? <UpdateTaxForm {...common} /> : <OilChangeForm {...common} />;
}
