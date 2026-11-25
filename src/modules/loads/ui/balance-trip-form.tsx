"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { registerBalanceTripAction } from "../application/load-actions";
import { balanceLeftText, tripBagsError, type PendingBalanceRow } from "../domain/load-balance";

const FIELD = "h-10 md:h-9";

/**
 * Registers a trip that carries part (or all) of the bags a load left behind: the day, the truck and the
 * bags, nothing about SIESA or cost. When the trip leaves bags behind it also asks when (and, optionally,
 * with which truck) the rest goes.
 */
export function BalanceTripForm({
  balance,
  plates,
  onDone,
  onCancel,
}: {
  balance: PendingBalanceRow;
  /** Plates of the registered fleet. */
  plates: readonly string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [bags, setBags] = useState(String(balance.remaining));
  const typed = /^\d+$/.test(bags.trim()) ? Number(bags.trim()) : Number.NaN;
  const leavesRest = Number.isInteger(typed) && typed >= 1 && typed < balance.remaining;
  const plateOptions = balance.plate !== null && !plates.includes(balance.plate) ? [balance.plate, ...plates] : plates;

  return (
    <ActionForm
      action={(fd) => {
        const problem = tripBagsError(typed, balance.remaining);
        if (problem) return Promise.resolve({ ok: false as const, error: problem });
        return registerBalanceTripAction(balance.balanceId, fd);
      }}
      submitLabel="Registrar faltante"
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="space-y-0.5 rounded-xl border bg-muted/40 p-3 text-sm">
        <p className="num font-semibold">
          Pedido #{balance.orderId} · {balance.supplier}
        </p>
        <p className="num text-muted-foreground">{balanceLeftText(balance)}</p>
        {balance.rescheduled && <p className="num text-xs text-muted-foreground">Cargue del {formatDisplayDate(balance.originalDate)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha del viaje" htmlFor="trip-date" required>
          <Input id="trip-date" name="date" type="date" className={FIELD} defaultValue={balance.scheduledDate} required />
        </Field>
        <Field label="Placa" htmlFor="trip-plate" required>
          <NativeSelect id="trip-plate" name="plate" defaultValue={balance.plate ?? ""} required>
            <option value="" disabled>
              Elige una placa
            </option>
            {plateOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="col-span-2">
          <Field label="Bultos del viaje" htmlFor="trip-bags" required hint={`Quedan ${balance.remaining} por llevar`}>
            <Input
              id="trip-bags"
              name="bags"
              inputMode="numeric"
              className={`${FIELD} num`}
              value={bags}
              autoComplete="off"
              required
              onChange={(e) => setBags(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {leavesRest && (
        <fieldset className="space-y-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">Lo que queda ({balance.remaining - typed} bultos)</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nueva fecha" htmlFor="trip-next-date" required>
              <Input id="trip-next-date" name="nextDate" type="date" className={FIELD} required />
            </Field>
            <Field label="Placa" htmlFor="trip-next-plate" hint="Opcional">
              <NativeSelect id="trip-next-plate" name="nextPlate" defaultValue="">
                <option value="">Sin placa</option>
                {plateOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}
