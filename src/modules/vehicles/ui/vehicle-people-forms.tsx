"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import {
  assignDriverAction,
  sellVehicleAction,
  transferOwnerAction,
} from "../application/vehicle-actions";
import type { FormProps } from "./vehicle-action-forms";

const FIELD = "h-10 md:h-9";

export function AssignDriverForm({ plate, ctx, onDone, onCancel }: FormProps) {
  return (
    <ActionForm
      action={(fd) => assignDriverAction(plate, fd)}
      submitLabel="Asignar conductor"
      onDone={onDone}
      onCancel={onCancel}
    >
      <p className="text-sm text-muted-foreground">
        El conductor actual queda cerrado en el historial con la fecha elegida.
      </p>
      <input type="hidden" name="mode" value="existing" />
      <Field label="Conductor" htmlFor="drv-id">
        <NativeSelect id="drv-id" name="driverId" defaultValue="" required>
          <option value="" disabled>
            Buscar en la lista un conductor…
          </option>
          {ctx.drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.nationalId ? ` · ${d.nationalId}` : ""}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Desde" htmlFor="drv-date">
        <Input id="drv-date" name="date" type="date" className={FIELD} defaultValue={ctx.today} max={ctx.today} required />
      </Field>
    </ActionForm>
  );
}

export function TransferOwnerForm({ plate, ctx, onDone, onCancel }: FormProps) {
  const defaultOwner = ctx.imperioOwnerId != null ? String(ctx.imperioOwnerId) : "IMPERIO";
  const [owner, setOwner] = useState(defaultOwner);

  return (
    <ActionForm
      action={(fd) => transferOwnerAction(plate, fd)}
      submitLabel="Traspasar"
      onDone={onDone}
      onCancel={onCancel}
    >
      <p className="text-sm text-muted-foreground">
        El propietario actual queda cerrado en el historial con la fecha del traspaso.
      </p>
      <Field label="Nuevo propietario" htmlFor="own-id">
        <NativeSelect id="own-id" name="owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
          {ctx.imperioOwnerId == null && <option value="IMPERIO">{KNOWN_OWNERS.IMPERIO.name}</option>}
          {[...ctx.owners]
            .sort((a, b) => Number(b.id === ctx.imperioOwnerId) - Number(a.id === ctx.imperioOwnerId))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          <option value="NEW">Otro propietario (nuevo)…</option>
        </NativeSelect>
      </Field>
      {owner === "NEW" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="own-name">
            <Input id="own-name" name="newName" className={FIELD} autoComplete="off" required />
          </Field>
          <Field label="Documento (opcional)" htmlFor="own-doc">
            <Input id="own-doc" name="newDocument" inputMode="numeric" className={FIELD} />
          </Field>
        </div>
      )}
      <Field label="Fecha del traspaso" htmlFor="own-date">
        <Input id="own-date" name="date" type="date" className={FIELD} defaultValue={ctx.today} max={ctx.today} required />
      </Field>
    </ActionForm>
  );
}

/** Live thousands separators for a peso amount ("45000000" -> "45.000.000"). */
export const formatPesos = (raw: string) => {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);
  return digits === "" ? "" : Number(digits).toLocaleString("es-CO");
};

export function SellForm({
  plate,
  ctx,
  current,
  onDone,
  onCancel,
}: FormProps & { current: { owner: string | null; driver: string | null } }) {
  const [date, setDate] = useState(ctx.today);
  const [price, setPrice] = useState("");
  const closesOn = date ? formatDisplayDate(date) : "la fecha de venta";

  const effects: Array<{ label: string; value: string; detail?: string }> = [
    { label: "Estado", value: "Vendido", detail: "sale de la flota activa" },
    {
      label: "Propietario",
      value: current.owner ?? "Sin propietario",
      detail: current.owner ? `se cierra el ${closesOn}` : undefined,
    },
    {
      label: "Conductor",
      value: current.driver ?? "Sin conductor",
      detail: current.driver ? `se cierra el ${closesOn}` : undefined,
    },
    { label: "Ficha", value: "Solo lectura", detail: "no admite más cambios" },
  ];

  return (
    <ActionForm
      action={(fd) => sellVehicleAction(plate, fd)}
      submitLabel="Registrar venta"
      pendingLabel="Registrando…"
      destructive
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Comprador" htmlFor="sale-buyer" hint="Persona o empresa que compra el vehículo.">
        <Input id="sale-buyer" name="buyer" className={FIELD} autoComplete="off" autoFocus />
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label="Fecha de venta" htmlFor="sale-date" required>
          <Input
            id="sale-date"
            name="date"
            type="date"
            className={FIELD}
            value={date}
            max={ctx.today}
            onChange={(e) => setDate(e.target.value)}
            required
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
        <Textarea id="sale-notes" name="notes" rows={2} placeholder="Forma de pago, acuerdos, entrega…" />
      </Field>

      <section aria-labelledby="sale-effects" className="rounded-xl border">
        <h3 id="sale-effects" className="border-b px-3 py-2 text-sm font-semibold">
          Al registrar la venta
        </h3>
        <dl>
          {effects.map(({ label, value, detail }) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-right">
                <span className="font-medium break-words">{value}</span>
                {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <label className="flex min-h-11 items-start gap-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        <input type="checkbox" required className="mt-0.5 size-5 shrink-0 accent-destructive" />
        <span>
          Entiendo que la venta de <span className="num font-semibold">{plate}</span> no se puede
          deshacer desde aquí.
        </span>
      </label>
    </ActionForm>
  );
}
