"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { discardUploadsAction, paySettlementAction } from "../application/cotero-actions";
import type { SettlementRow } from "../domain/settlement-rows";
import { isPaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../domain/settlement-rules";
import { formatCop } from "./format";
import { uploadProof } from "./proof-upload";

function Form({ settlement, today, onDone, onCancel }: { settlement: SettlementRow; today: string; onDone: (message: string) => void; onCancel: () => void }) {
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>(settlement.paymentMethod ?? "efectivo");
  const [proof, setProof] = useState<File | null>(null);

  /** Uploads the proof (shrunk) straight to storage, then records the payment; a refused payment drops the upload. */
  async function pay() {
    let proofPath: string | null = null;
    if (proof) {
      const uploaded = await uploadProof(proof);
      if (!uploaded.ok) return uploaded;
      proofPath = uploaded.path;
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
      <Field label="Comprobante (foto o PDF)" htmlFor="pay-proof" hint="Opcional.">
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

/** Side sheet to record the payment of a legacy open settlement (new ones are created already paid). */
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
