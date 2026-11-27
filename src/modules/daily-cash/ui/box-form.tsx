"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { createBoxAction } from "../application/daily-cash-actions";
import { isFirstBox } from "../domain/box-rules";

/**
 * Creates the box of a day (one per date). The opening balance is typed only when the box would be
 * the earliest of the user's; every later one opens with the cash counted in the previous box.
 */
export function BoxForm({
  boxes,
  today,
  onDone,
  onCancel,
}: {
  boxes: ReadonlyArray<{ date: IsoDate }>;
  today: IsoDate;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState<string>(today);
  const taken = date !== "" && boxes.some((b) => b.date === date);
  // An empty date (being retyped) must not flip the field on and off.
  const asksOpening = boxes.length === 0 || (date !== "" && isFirstBox(boxes, date));

  return (
    <ActionForm action={createBoxAction} submitLabel="Crear caja" onDone={onDone} onCancel={onCancel}>
      <Field label="Fecha de la caja" htmlFor="box-date" required hint={taken ? "Ya hay una caja para esa fecha." : undefined}>
        <Input id="box-date" name="date" type="date" className="h-10 md:h-9" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      {asksOpening ? (
        <Field
          label="Saldo inicial"
          htmlFor="box-opening"
          required
          hint="Esta será la primera caja: escribe el efectivo con el que empieza. Las siguientes parten del arqueo de la anterior."
        >
          <PesosInput id="box-opening" name="openingBalance" required />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">El saldo de esta caja es el efectivo contado en la caja anterior.</p>
      )}
    </ActionForm>
  );
}
