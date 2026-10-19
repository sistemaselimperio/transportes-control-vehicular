"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import {
  assignDriverAction,
  sellVehicleAction,
  transferOwnerAction,
} from "../application/vehicle-actions";
import type { FormProps } from "./vehicle-action-forms";

const FIELD = "h-10 md:h-9";

export function AssignDriverForm({ plate, ctx, onDone, onCancel }: FormProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");

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
      <Field label="Conductor" htmlFor="drv-mode">
        <NativeSelect
          id="drv-mode"
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "existing" | "new")}
        >
          <option value="existing">Elegir uno existente</option>
          <option value="new">Crear conductor nuevo</option>
        </NativeSelect>
      </Field>
      {mode === "existing" ? (
        <Field label="Buscar en la lista" htmlFor="drv-id">
          <NativeSelect id="drv-id" name="driverId" defaultValue="" required>
            <option value="" disabled>
              Selecciona…
            </option>
            {ctx.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.nationalId ? ` · ${d.nationalId}` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : (
        <>
          <Field label="Nombre completo" htmlFor="drv-name">
            <Input id="drv-name" name="name" className={FIELD} autoComplete="off" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cédula (opcional)" htmlFor="drv-national">
              <Input id="drv-national" name="nationalId" inputMode="numeric" className={FIELD} />
            </Field>
            <Field label="Celular (opcional)" htmlFor="drv-phone">
              <Input id="drv-phone" name="phone" type="tel" className={FIELD} />
            </Field>
          </div>
        </>
      )}
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

export function SellForm({ plate, ctx, onDone, onCancel }: FormProps) {
  return (
    <ActionForm
      action={(fd) => sellVehicleAction(plate, fd)}
      submitLabel="Registrar venta"
      onDone={onDone}
      onCancel={onCancel}
    >
      <p role="note" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
        El vehículo quedará como Vendido y se cerrarán el propietario y el conductor actuales. No se
        puede deshacer desde aquí.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de venta" htmlFor="sale-date">
          <Input id="sale-date" name="date" type="date" className={FIELD} defaultValue={ctx.today} max={ctx.today} required />
        </Field>
        <Field label="Precio (opcional)" htmlFor="sale-price">
          <Input id="sale-price" name="price" inputMode="numeric" className={FIELD} placeholder="$" />
        </Field>
      </div>
      <Field label="Comprador" htmlFor="sale-buyer">
        <Input id="sale-buyer" name="buyer" className={FIELD} autoComplete="off" />
      </Field>
      <Field label="Notas (opcional)" htmlFor="sale-notes">
        <Textarea id="sale-notes" name="notes" rows={2} />
      </Field>
    </ActionForm>
  );
}
