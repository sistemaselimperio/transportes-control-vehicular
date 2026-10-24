"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { formatPesos } from "@/modules/vehicles/ui/vehicle-people-forms";
import { updateSaleAction } from "../application/sale-actions";
import type { SaleRow } from "../domain/sale-row";

const FIELD = "h-10 md:h-9";

/** Edits the date, buyer, price and notes of a registered sale. */
export function SaleForm({
  sale,
  onDone,
  onCancel,
}: {
  sale: SaleRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(sale.price === null ? "" : formatPesos(String(sale.price)));

  return (
    <ActionForm
      action={(fd) => updateSaleAction(sale.id, fd)}
      submitLabel="Guardar cambios"
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Comprador" htmlFor="sale-buyer" hint="Persona o empresa que compró el vehículo.">
        <Input id="sale-buyer" name="buyer" className={FIELD} defaultValue={sale.buyer ?? ""} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label="Fecha de venta" htmlFor="sale-date">
          <Input
            id="sale-date"
            name="date"
            type="date"
            className={FIELD}
            defaultValue={sale.date ?? ""}
            max={todayInBogota()}
          />
        </Field>
        <Field label="Precio (opcional)" htmlFor="sale-price">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            >
              $
            </span>
            <Input
              id="sale-price"
              name="price"
              inputMode="numeric"
              autoComplete="off"
              className={`${FIELD} num pl-7`}
              value={price}
              onChange={(e) => setPrice(formatPesos(e.target.value))}
            />
          </div>
        </Field>
      </div>
      <Field label="Notas (opcional)" htmlFor="sale-notes">
        <Textarea
          id="sale-notes"
          name="notes"
          rows={3}
          defaultValue={sale.notes ?? ""}
          placeholder="Forma de pago, acuerdos, entrega…"
        />
      </Field>
    </ActionForm>
  );
}
