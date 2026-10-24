"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import type { AttentionItem, ItemKind } from "@/modules/dashboard/domain/dashboard-metrics";
import { describeDaysLeft } from "@/modules/today/domain/urgency";
import { loadActionContextAction } from "@/modules/vehicles/application/vehicle-actions";
import type { VehicleActionContext } from "@/modules/vehicles/application/vehicle-queries";
import {
  OilChangeForm,
  RenewDocumentForm,
  UpdateTaxForm,
  type DocumentType,
} from "@/modules/vehicles/ui/vehicle-action-forms";

export const KIND_LABELS: Record<ItemKind, string> = {
  SOAT: "SOAT",
  TECNO: "Tecnomecánica",
  POLICY: "Póliza",
  TAX: "Impuesto",
  OIL: "Cambio de aceite",
};

export const ACTION_LABELS: Record<ItemKind, string> = {
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

const isDocument = (kind: ItemKind): kind is DocumentType =>
  kind === "SOAT" || kind === "TECNO" || kind === "POLICY";

/** "en 3 días" when there is a date, otherwise the plain status. */
export function pillText(item: AttentionItem): string {
  if (item.daysLeft !== null) return describeDaysLeft(item.daysLeft);
  return item.status === "expired" ? "Vencido" : "Por vencer";
}

interface Active {
  item: AttentionItem;
  ctx: VehicleActionContext | null;
  failed: boolean;
}

/**
 * Quick action per attention item: opens a side panel with the matching form
 * and shows a confirmation once it is saved. Render `banner` and `panel` once.
 */
export function useAttentionAction() {
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

  const banner = message && (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );

  const panel = (
    <SlideOver
      open={open}
      onOpenChange={setOpen}
      title={item ? PANEL_TITLES[item.kind] : ""}
      description={item ? `Vehículo ${item.plate}` : undefined}
    >
      {item && isDocument(item.kind) && (
        <RenewDocumentForm plate={item.plate} initialType={item.kind} onDone={done} onCancel={close} />
      )}
      {item && !isDocument(item.kind) && active && (
        <ContextForm
          active={active}
          onDone={done}
          onCancel={close}
          onRetry={() => {
            setActive({ item: active.item, ctx: null, failed: false });
            fetchContext(active.item);
          }}
        />
      )}
    </SlideOver>
  );

  return {
    openFor,
    isActive: (row: AttentionItem) => open && active?.item === row,
    banner,
    panel,
  };
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
