"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ALLOWED_MIME, MAX_FILE_BYTES } from "@/modules/documents/domain/vehicle-file-rules";
import { optimizeFile } from "@/modules/documents/ui/optimize-file";
import { discardUploadsAction, paySettlementAction, prepareUploadsAction } from "../application/cotero-actions";
import type { SettlementRow } from "../domain/settlement-rows";
import { isPaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../domain/settlement-rules";
import { formatCop } from "./format";

async function uploadToStorage(uploadUrl: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
  return res.ok;
}

function Form({ settlement, today, onDone, onCancel }: { settlement: SettlementRow; today: string; onDone: (message: string) => void; onCancel: () => void }) {
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>(settlement.paymentMethod ?? "efectivo");
  const [proof, setProof] = useState<File | null>(null);

  /** Uploads the proof (shrunk) straight to storage, then records the payment; a refused payment drops the upload. */
  async function pay() {
    let proofPath: string | null = null;
    if (proof) {
      if (!(ALLOWED_MIME as readonly string[]).includes(proof.type)) return { ok: false as const, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };
      const stored = await optimizeFile(proof);
      if (stored.size > MAX_FILE_BYTES) return { ok: false as const, error: "El comprobante supera el límite de 4 MB." };
      const target = await prepareUploadsAction([{ kind: "proof", mimeType: stored.type, size: stored.size }]);
      if (!target.ok) return { ok: false as const, error: target.error };
      if (!(await uploadToStorage(target.uploads[0].uploadUrl, stored))) {
        return { ok: false as const, error: "No se pudo subir el comprobante. Intenta de nuevo." };
      }
      proofPath = target.uploads[0].path;
    }
    const result = await paySettlementAction(settlement.id, { paidAt, paymentMethod: method, proofPath });
    if (!result.ok && proofPath) void discardUploadsAction([proofPath]);
    return result;
  }

  return (
    <ActionForm action={pay} submitLabel="Registrar pago" pendingLabel="Registrando…" onDone={onDone} onCancel={onCancel}>
      <p className="rounded-xl border bg-card p-3 text-sm">
        <span className="font-medium">{settlement.coteroName}</span>
        <span className="num block text-lg font-semibold">{formatCop(settlement.total)}</span>
      </p>
      <Field label="Fecha de pago" htmlFor="pay-date" required>
        <Input id="pay-date" type="date" className="h-11 md:h-9" value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} />
      </Field>
      <Field label="Forma de pago" htmlFor="pay-method" required>
        <NativeSelect id="pay-method" className="h-11 md:h-9" value={method} onChange={(e) => isPaymentMethod(e.target.value) && setMethod(e.target.value)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Comprobante (foto o PDF)" htmlFor="pay-proof" hint="Opcional. Una liquidación pagada queda cerrada y ya no se puede anular.">
        <Input
          id="pay-proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="h-auto py-2"
          onChange={(e) => setProof(e.target.files?.[0] ?? null)}
        />
      </Field>
    </ActionForm>
  );
}

/** Side sheet to record the payment of an open settlement. */
export function SettlementPay({
  settlement,
  today,
  onClose,
  onDone,
}: {
  settlement: SettlementRow | undefined;
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <SlideOver
      open={settlement !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar pago"
      description={settlement && `Liquidación ${settlement.number}`}
    >
      {settlement && (
        <Form
          key={settlement.id}
          settlement={settlement}
          today={today}
          onCancel={onClose}
          onDone={(message) => {
            onDone(message);
            onClose();
          }}
        />
      )}
    </SlideOver>
  );
}
