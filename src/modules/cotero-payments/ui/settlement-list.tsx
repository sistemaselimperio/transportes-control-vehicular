"use client";

import { AlertTriangle, Banknote, Download, Paperclip, Printer, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { annulSettlementAction, deleteSettlementAction } from "../application/cotero-actions";
import { formatVehiclePlate } from "../domain/plates";
import type { ReceiptRow } from "../domain/receipt-rules";
import type { SettlementRow } from "../domain/settlement-rows";
import { PAYMENT_METHOD_LABELS } from "../domain/settlement-rules";
import { SettlementStatusBadge } from "./badges";
import { formatCop } from "./format";

/** One card per settlement: number, cotero, total and state, with its receipts, its sheet and its actions. */
export function SettlementList({
  rows,
  receipts,
  onPay,
  onDone,
}: {
  rows: readonly SettlementRow[];
  receipts: readonly ReceiptRow[];
  onPay: (settlement: SettlementRow) => void;
  onDone: (message: string) => void;
}) {
  const [annulling, setAnnulling] = useState<SettlementRow | undefined>();
  const [deleting, setDeleting] = useState<SettlementRow | undefined>();
  const byId = useMemo(() => {
    const map = new Map<number, ReceiptRow[]>();
    for (const r of receipts) if (r.settlementId !== null) map.set(r.settlementId, [...(map.get(r.settlementId) ?? []), r]);
    return map;
  }, [receipts]);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay liquidaciones.</p>;
  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((s) => {
          const own = byId.get(s.id) ?? [];
          return (
            <li key={s.id} className="panel">
              <div className="flex items-start justify-between gap-2 border-b bg-muted/60 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="num font-semibold">Liquidación {s.number}</p>
                  <p className="font-medium">{s.coteroName}</p>
                  <p className="num text-xs text-muted-foreground">
                    {formatDisplayDate(s.date)}
                    {s.coteroDocument ? ` · C.C. ${s.coteroDocument}` : ""}
                  </p>
                </div>
                <SettlementStatusBadge status={s.status} />
              </div>

              <div className="space-y-1 px-4 py-3 text-sm">
                <p className="num text-lg font-semibold">{formatCop(s.total)}</p>
                <p className="text-muted-foreground">
                  {s.paymentMethod ? PAYMENT_METHOD_LABELS[s.paymentMethod] : "Forma de pago sin definir"}
                  {s.paymentAccount ? ` · ${s.paymentAccount}` : ""}
                </p>
                {s.status === "paid" && s.paidAt && <p className="num text-muted-foreground">Pagada el {formatDisplayDate(s.paidAt)}</p>}
              </div>

              {s.status !== "annulled" && own.length > 0 && (
                <details className="border-t px-4 py-2.5">
                  <summary className="num cursor-pointer rounded-sm text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
                    {own.length} {own.length === 1 ? "recibo" : "recibos"}
                  </summary>
                  <ul className="mt-2 divide-y rounded-lg border bg-background text-xs">
                    {own.map((r) => (
                      <li key={r.id} className="num flex items-baseline justify-between gap-3 px-2.5 py-1.5">
                        <span className="min-w-0">
                          <span className="font-semibold">{r.receiptNumber}</span> · {formatDisplayDate(r.date)} · {formatVehiclePlate(r.vehiclePlate)} · {formatDecimal(r.tons, 3)} t
                        </span>
                        <span className="shrink-0 font-semibold">{formatCop(r.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex flex-wrap items-center justify-between gap-1 border-t px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {s.status !== "annulled" && (
                    <a
                      href={`/api/pagos-coteros/liquidaciones/${s.id}/excel`}
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm text-brand outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9"
                    >
                      <Download className="size-4" aria-hidden />
                      Excel
                    </a>
                  )}
                  {s.status !== "annulled" && (
                    <a
                      href={`/pagos-coteros/liquidaciones/${s.id}/imprimir`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm text-brand outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9"
                    >
                      <Printer className="size-4" aria-hidden />
                      Imprimir comprobante
                    </a>
                  )}
                  {s.hasProof && (
                    <a
                      href={`/api/pagos-coteros/liquidaciones/${s.id}/comprobante`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm text-brand outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9"
                    >
                      <Paperclip className="size-4" aria-hidden />
                      Comprobante
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {s.status === "open" && (
                    <Button variant="outline" className="h-11 px-3 md:h-9" onClick={() => onPay(s)}>
                      <Banknote aria-hidden />
                      Registrar pago
                    </Button>
                  )}
                  {s.status !== "annulled" && (
                    <Button variant="ghost" className="h-11 px-3 text-destructive md:h-9" onClick={() => setAnnulling(s)}>
                      <Undo2 aria-hidden />
                      Anular
                    </Button>
                  )}
                  <Button variant="ghost" className="h-11 px-3 text-destructive md:h-9" onClick={() => setDeleting(s)}>
                    <Trash2 aria-hidden />
                    Eliminar
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <SlideOver
        open={annulling !== undefined}
        onOpenChange={(open) => !open && setAnnulling(undefined)}
        title="Anular liquidación"
        description={annulling && `Liquidación ${annulling.number} · ${annulling.coteroName}`}
      >
        {annulling && (
          <ActionForm
            action={() => annulSettlementAction(annulling.id)}
            submitLabel="Anular liquidación"
            pendingLabel="Anulando…"
            destructive
            onCancel={() => setAnnulling(undefined)}
            onDone={(message) => {
              onDone(message);
              setAnnulling(undefined);
            }}
          >
            <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive-faint p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <p className="font-medium">
                Los {annulling.receiptCount} recibos de esta liquidación vuelven a estar en Pendiente y podrás liquidarlos de nuevo.{annulling.status === "paid" ? " El pago registrado deja de contar." : ""} El número {annulling.number} no se reutiliza.
              </p>
            </div>
          </ActionForm>
        )}
      </SlideOver>

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar liquidación"
        description={deleting && `Liquidación ${deleting.number} · ${deleting.coteroName}`}
        warning={
          deleting
            ? `La liquidación ${deleting.number} se elimina para siempre${deleting.receiptCount > 0 ? " y sus recibos vuelven a Pendiente" : ""}. ${deleting.hasProof ? "La foto del comprobante de pago también se elimina. " : ""}Un comprobante ya impreso dejará de coincidir.`
            : ""
        }
        action={() => (deleting ? deleteSettlementAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin liquidación." }))}
        onClose={() => setDeleting(undefined)}
        onDone={onDone}
      />
    </>
  );
}
