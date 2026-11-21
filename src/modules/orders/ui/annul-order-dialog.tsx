"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { annulOrderAction } from "../application/order-actions";
import type { OrderRow } from "../domain/order-rules";

/** Confirmation to annul a pending order. An annulled order stays in the list (hidden by default). */
export function AnnulOrderDialog({
  order,
  onClose,
  onDone,
}: {
  order: OrderRow | undefined;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setError(null);
    onClose();
  }

  function confirm() {
    if (!order) return;
    setError(null);
    startTransition(async () => {
      const result = await annulOrderAction(order.id);
      if (result.ok) {
        onDone(result.message);
        close();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <SlideOver
      open={order !== undefined}
      onOpenChange={(next) => !pending && !next && close()}
      title="Anular pedido"
      description={order && `Pedido #${order.id} · ${formatDisplayDate(order.deliveryDate)}`}
    >
      <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive-faint p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">{order ? `Se anulará el pedido #${order.id}.` : ""}</p>
              <p className="text-muted-foreground">Un pedido anulado ya no se puede editar ni cargar.</p>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" className="h-11 px-4 md:h-9" disabled={pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" className="h-11 px-4 md:h-9" disabled={pending} onClick={confirm}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? "Anulando…" : "Anular pedido"}
          </Button>
        </div>
      </div>
    </SlideOver>
  );
}
