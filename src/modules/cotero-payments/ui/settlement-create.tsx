"use client";

import { useMemo, useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { createSettlementAction } from "../application/cotero-actions";
import { groupByCotero } from "../domain/cotero-identity";
import { formatVehiclePlate } from "../domain/plates";
import { totalsOfReceipts, type ReceiptRow } from "../domain/receipt-rules";
import type { CoteroProfileRow } from "../domain/settlement-rows";
import { isPaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../domain/settlement-rules";
import { formatCop } from "./format";

function Form({
  pending,
  profiles,
  presetKey,
  onDone,
  onCancel,
}: {
  pending: readonly ReceiptRow[];
  profiles: readonly CoteroProfileRow[];
  presetKey: string | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const groups = useMemo(() => groupByCotero(pending), [pending]);
  const profileOf = (key: string) => profiles.find((p) => p.key === key);
  const groupOf = (key: string) => groups.find((g) => g.key === key);

  const [coteroKey, setCoteroKey] = useState(() => (presetKey && groupOf(presetKey) ? presetKey : (groups[0]?.key ?? "")));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unchecked, setUnchecked] = useState<ReadonlySet<number>>(new Set());
  const initialProfile = profileOf(coteroKey);
  const [document, setDocument] = useState(initialProfile?.document ?? groupOf(coteroKey)?.document ?? "");
  const [method, setMethod] = useState<PaymentMethod | "">(initialProfile?.paymentMethod ?? "");
  const [account, setAccount] = useState(initialProfile?.paymentAccount ?? "");

  const group = groupOf(coteroKey);
  const inRange = (group?.items ?? []).filter((r) => (!from || r.date >= from) && (!to || r.date <= to)).sort((a, b) => a.date.localeCompare(b.date));
  const chosen = inRange.filter((r) => !unchecked.has(r.id));
  const totals = totalsOfReceipts(chosen);

  function pickCotero(key: string) {
    const profile = profileOf(key);
    setCoteroKey(key);
    setUnchecked(new Set());
    setDocument(profile?.document ?? groupOf(key)?.document ?? "");
    setMethod(profile?.paymentMethod ?? "");
    setAccount(profile?.paymentAccount ?? "");
  }

  function toggle(id: number, on: boolean) {
    const next = new Set(unchecked);
    if (on) next.delete(id);
    else next.add(id);
    setUnchecked(next);
  }

  if (groups.length === 0) {
    return <p className="px-5 py-5 text-sm text-muted-foreground">No hay recibos pendientes por liquidar.</p>;
  }

  return (
    <ActionForm
      action={() =>
        createSettlementAction({ coteroKey, receiptIds: chosen.map((r) => r.id), document, paymentMethod: method, paymentAccount: account })
      }
      submitLabel={chosen.length === 0 ? "Liquidar" : `Liquidar ${formatCop(totals.amount)}`}
      pendingLabel="Liquidando…"
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Cotero" htmlFor="settle-cotero" required>
        <NativeSelect id="settle-cotero" className="h-11 md:h-9" value={coteroKey} onChange={(e) => pickCotero(e.target.value)}>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name} · {g.items.length} {g.items.length === 1 ? "recibo" : "recibos"}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" htmlFor="settle-from">
          <Input id="settle-from" type="date" className="h-11 md:h-9" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta" htmlFor="settle-to">
          <Input id="settle-to" type="date" className="h-11 md:h-9" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm">Recibos pendientes</legend>
        {inRange.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay recibos pendientes en esas fechas.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {inRange.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" className="size-4 shrink-0 accent-brand" checked={!unchecked.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />
                  <span className="min-w-0 flex-1">
                    <span className="num font-medium">{r.receiptNumber}</span>
                    <span className="num text-muted-foreground">
                      {" "}
                      · {formatDisplayDate(r.date)} · {formatVehiclePlate(r.vehiclePlate)} · {formatDecimal(r.tons, 3)} t
                    </span>
                  </span>
                  <span className="num shrink-0 font-semibold">{formatCop(r.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="num text-sm font-semibold" aria-live="polite">
          {totals.count} {totals.count === 1 ? "recibo" : "recibos"} · {formatDecimal(totals.tons, 3)} t · {formatCop(totals.amount)}
        </p>
      </fieldset>

      <Field label="Cédula o NIT" htmlFor="settle-document" hint="Se recuerda para la próxima liquidación de este cotero.">
        <Input id="settle-document" inputMode="numeric" autoComplete="off" className="h-11 md:h-9" value={document} onChange={(e) => setDocument(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Forma de pago" htmlFor="settle-method">
          <NativeSelect
            id="settle-method"
            className="h-11 md:h-9"
            value={method}
            onChange={(e) => setMethod(isPaymentMethod(e.target.value) ? e.target.value : "")}
          >
            <option value="">Sin definir</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Cuenta o celular" htmlFor="settle-account">
          <Input id="settle-account" autoComplete="off" className="h-11 md:h-9" value={account} onChange={(e) => setAccount(e.target.value)} />
        </Field>
      </div>
    </ActionForm>
  );
}

/** Side sheet to liquidate the pending receipts of one cotero. */
export function SettlementCreate({
  open,
  onOpenChange,
  receipts,
  profiles,
  presetKey,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipts: readonly ReceiptRow[];
  profiles: readonly CoteroProfileRow[];
  /** A cotero to start with (from the list's filter). */
  presetKey: string | null;
  onDone: (message: string) => void;
}) {
  const pending = useMemo(() => receipts.filter((r) => r.status === "pending"), [receipts]);
  return (
    <SlideOver open={open} onOpenChange={onOpenChange} title="Liquidar a un cotero" description="Elige los recibos pendientes que entran en la liquidación." wide>
      <Form
        pending={pending}
        profiles={profiles}
        presetKey={presetKey}
        onCancel={() => onOpenChange(false)}
        onDone={(message) => {
          onDone(message);
          onOpenChange(false);
        }}
      />
    </SlideOver>
  );
}
