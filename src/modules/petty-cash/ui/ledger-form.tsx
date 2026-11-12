"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { createLedgerAction, updateLedgerAction } from "../application/petty-cash-actions";
import { wouldBeFirst } from "../domain/ledger-balances";

export interface LedgerFormValues {
  id: number;
  date: IsoDate;
  compenseAmount: number;
  openingBalance: number;
}

/**
 * Creates a ledger, or edits `ledger`. The opening balance is typed only for the earliest ledger of
 * the user: the very first one, or any ledger whose date places it before all the others. Every
 * later one opens with the previous closing balance.
 */
export function LedgerForm({
  ledger,
  ledgers,
  today,
  onDone,
  onCancel,
}: {
  ledger?: LedgerFormValues;
  /** Every ledger of the user (the edited one included). */
  ledgers: ReadonlyArray<{ id: number; date: IsoDate }>;
  today: IsoDate;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState<string>(ledger?.date ?? today);
  const others = ledgers.filter((l) => l.id !== ledger?.id);
  // An empty date (being retyped) must not flip the field on and off.
  const asksOpening = others.length === 0 || (date !== "" && wouldBeFirst(others, { id: ledger?.id ?? null, date: date as IsoDate }));
  const wasFirst = ledger ? wouldBeFirst(others, { id: ledger.id, date: ledger.date }) : false;
  const becomesFirst = asksOpening && others.length > 0 && !wasFirst;

  return (
    <ActionForm
      action={(fd) => (ledger ? updateLedgerAction(ledger.id, fd) : createLedgerAction(fd))}
      submitLabel={ledger ? "Guardar cambios" : "Crear planilla"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Fecha del compense" htmlFor="ledger-date" required>
        <Input
          id="ledger-date"
          name="date"
          type="date"
          className="h-10 md:h-9"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </Field>
      <Field label="Valor del compense" htmlFor="ledger-compense" required>
        <PesosInput id="ledger-compense" name="compenseAmount" defaultValue={ledger?.compenseAmount} required />
      </Field>
      {asksOpening ? (
        <Field
          label="Saldo inicial"
          htmlFor="ledger-opening"
          required={becomesFirst && !ledger}
          hint={
            becomesFirst
              ? "Por su fecha, esta planilla queda como la primera: escribe el saldo con el que empieza la caja. Las demás se recalculan desde aquí."
              : "Solo se escribe en la primera planilla. Las siguientes inician con el saldo final de la anterior."
          }
        >
          <PesosInput
            id="ledger-opening"
            name="openingBalance"
            defaultValue={wasFirst ? ledger?.openingBalance : undefined}
            required={becomesFirst && !ledger}
          />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">El saldo inicial es el saldo final de la planilla anterior.</p>
      )}
    </ActionForm>
  );
}
