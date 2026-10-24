"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export const ACTION_TITLES: Record<ItemKind, string> = {
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

/** Transient success message shown above the list once a form is saved. */
export function useDoneMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(msg: string) {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 6000);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const banner = message && (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
  return { banner, flash };
}

/**
 * The form that resolves one attention item. Renders inline (desktop panel) or
 * inside a SlideOver (phone). Documents need no extra data; tax and oil load
 * the vehicle context on mount. Key it by plate + kind so it starts fresh.
 */
export function ActionFormBody({
  item,
  onDone,
  onCancel,
}: {
  item: AttentionItem;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  if (isDocument(item.kind)) {
    return <RenewDocumentForm plate={item.plate} initialType={item.kind} onDone={onDone} onCancel={onCancel} />;
  }
  return <ContextForm item={item} onDone={onDone} onCancel={onCancel} />;
}

function ContextForm({
  item,
  onDone,
  onCancel,
}: {
  item: AttentionItem;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [ctx, setCtx] = useState<VehicleActionContext | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadActionContextAction(item.plate).then((next) => {
      if (cancelled) return;
      setCtx(next);
      setFailed(next === null);
    });
    return () => {
      cancelled = true;
    };
  }, [item.plate, attempt]);

  if (failed) {
    return (
      <div className="space-y-3 p-4">
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          No se pudieron cargar los datos del vehículo.
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => {
            setFailed(false);
            setCtx(null);
            setAttempt((n) => n + 1);
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }
  if (!ctx) {
    return (
      <div className="space-y-4 p-4" aria-busy="true" aria-label="Cargando datos del vehículo">
        <div className="skeleton h-9 w-full" />
        <div className="skeleton h-9 w-2/3" />
        <div className="skeleton h-9 w-full" />
      </div>
    );
  }
  const common = { plate: item.plate, ctx, onDone, onCancel };
  return item.kind === "TAX" ? <UpdateTaxForm {...common} /> : <OilChangeForm {...common} />;
}
