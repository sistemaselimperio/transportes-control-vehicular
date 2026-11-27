"use client";

import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addExpenseAction, addIncomeAction, updateEntryAction } from "../application/daily-cash-actions";
import type { EntryRow } from "../domain/daily-cash-rows";
import { COMPANIES, COMPANY_LABELS } from "../domain/voucher-import";

/** Creates or edits a manual expense (with its company) or income (a concept). */
export function EntryForm({
  boxId,
  kind,
  entry,
  onDone,
  onCancel,
}: {
  boxId: number;
  kind: "expense" | "income";
  /** The entry being edited; absent when creating. */
  entry?: EntryRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const expense = kind === "expense";
  return (
    <ActionForm
      action={(fd) => (entry ? updateEntryAction(entry.id, fd) : expense ? addExpenseAction(boxId, fd) : addIncomeAction(boxId, fd))}
      submitLabel={entry ? "Guardar cambios" : "Agregar"}
      onDone={onDone}
      onCancel={onCancel}
    >
      {expense && (
        <Field label="Empresa" htmlFor="entry-company" required>
          <NativeSelect id="entry-company" name="company" required className="h-10 md:h-9" defaultValue={entry?.company ?? ""}>
            <option value="" disabled>
              Elige la empresa
            </option>
            {COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c} · {COMPANY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label={expense ? "Detalle" : "Concepto"} htmlFor="entry-detail" required>
        <Input id="entry-detail" name="detail" required maxLength={200} autoComplete="off" className="h-10 md:h-9" defaultValue={entry?.detail ?? ""} />
      </Field>
      <Field label="Valor" htmlFor="entry-value" required>
        <PesosInput id="entry-value" name="value" defaultValue={entry?.value} required />
      </Field>
    </ActionForm>
  );
}
