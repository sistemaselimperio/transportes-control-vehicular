"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { OilChangeValues } from "@/modules/maintenance/domain/oil-items";
import { planOilChange } from "@/modules/maintenance/domain/plan-oil-change";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import {
  registerOilChangeAction,
  renewDocumentAction,
  updateKmAction,
  updateOilChangeAction,
  updateTaxAction,
} from "../application/vehicle-actions";
import type { VehicleActionContext } from "../application/vehicle-queries";
import { formatKm } from "../domain/vehicle-row";

export interface FormProps {
  plate: string;
  ctx: VehicleActionContext;
  onDone: (message: string) => void;
  onCancel: () => void;
}

const FIELD = "h-10 md:h-9";

const toNumber = (text: string): number | null => {
  const digits = text.replace(/[.,\s]/g, "");
  return /^\d{1,10}$/.test(digits) ? Number(digits) : null;
};

export type DocumentType = "SOAT" | "TECNO" | "POLICY";

export function RenewDocumentForm({
  plate,
  onDone,
  onCancel,
  initialType = "SOAT",
}: Omit<FormProps, "ctx"> & { initialType?: DocumentType }) {
  const [type, setType] = useState<string>(initialType);
  const [notApplicable, setNotApplicable] = useState(false);

  return (
    <ActionForm
      action={(fd) => renewDocumentAction(plate, fd)}
      submitLabel="Guardar documento"
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Documento" htmlFor="doc-type">
        <NativeSelect id="doc-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="SOAT">SOAT</option>
          <option value="TECNO">Tecnomecánica</option>
          <option value="POLICY">Póliza</option>
        </NativeSelect>
      </Field>
      {type === "POLICY" && (
        <Field label="Tipo de póliza" htmlFor="doc-kind">
          <NativeSelect id="doc-kind" name="policyKind" defaultValue="TR">
            <option value="TR">Todo riesgo (TR)</option>
            <option value="RC">Responsabilidad civil (RC)</option>
          </NativeSelect>
        </Field>
      )}
      <Field
        label="Nueva fecha de vencimiento"
        htmlFor="doc-expires"
        hint="El registro anterior se conserva en el historial."
      >
        <Input
          id="doc-expires"
          name="expiresOn"
          type="date"
          className={FIELD}
          disabled={notApplicable}
          required={!notApplicable}
        />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="notApplicable"
          className="size-5"
          checked={notApplicable}
          onChange={(e) => setNotApplicable(e.target.checked)}
        />
        No aplica para este vehículo
      </label>
    </ActionForm>
  );
}

export function UpdateTaxForm({ plate, ctx, onDone, onCancel }: FormProps) {
  const [kind, setKind] = useState("PAID_YEAR");

  return (
    <ActionForm
      action={(fd) => updateTaxAction(plate, fd)}
      submitLabel="Guardar impuesto"
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Estado del impuesto" htmlFor="tax-kind">
        <NativeSelect id="tax-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="PAID_YEAR">Pagado (año)</option>
          <option value="EXEMPT">No paga</option>
          <option value="EXEMPT_LOW_DISPLACEMENT">No paga por cilindraje inferior</option>
        </NativeSelect>
      </Field>
      {kind === "PAID_YEAR" && (
        <Field label="Año pagado" htmlFor="tax-year">
          <Input
            id="tax-year"
            name="year"
            inputMode="numeric"
            className={FIELD}
            defaultValue={ctx.today.slice(0, 4)}
            required
          />
        </Field>
      )}
    </ActionForm>
  );
}

/** What the oil change form needs to know about the vehicle. */
export type OilFormContext = Pick<
  VehicleActionContext,
  "today" | "odometerWorking" | "currentKm" | "oilMode" | "oilInterval" | "lastOilItems"
>;

/** Registers an oil change, or edits one when `editing` is given. */
export function OilChangeForm({
  plate,
  ctx,
  editing,
  onDone,
  onCancel,
}: Omit<FormProps, "ctx"> & { ctx: OilFormContext; editing?: OilChangeValues }) {
  const [date, setDate] = useState(editing?.date ?? ctx.today);
  const [km, setKm] = useState(editing?.km?.toString() ?? "");
  const [months, setMonths] = useState((editing ? editing.intervalMonths : ctx.oilInterval.months)?.toString() ?? "");
  const [intervalKm, setIntervalKm] = useState((editing ? editing.intervalKm : ctx.oilInterval.km)?.toString() ?? "");
  let preview: string;
  try {
    const plan = planOilChange({
      date,
      km: toNumber(km),
      today: ctx.today,
      vehicle: ctx,
      interval: { months: toNumber(months), km: toNumber(intervalKm) },
    });
    preview =
      [
        plan.nextDate ? formatDisplayDate(plan.nextDate) : null,
        plan.nextKm != null ? `${formatKm(plan.nextKm)} km` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Sin fecha calculada";
  } catch {
    preview = "Completa la fecha y el kilometraje";
  }

  return (
    <ActionForm
      action={(fd) => (editing ? updateOilChangeAction(editing.id, fd) : registerOilChangeAction(plate, fd))}
      submitLabel={editing ? "Guardar cambios" : "Registrar cambio"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha del cambio" htmlFor="oil-date">
          <Input
            id="oil-date"
            name="date"
            type="date"
            className={FIELD}
            value={date}
            max={ctx.today}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field
          label={ctx.odometerWorking ? "Kilometraje" : "Kilometraje (opcional)"}
          htmlFor="oil-km"
        >
          <Input
            id="oil-km"
            name="km"
            inputMode="numeric"
            className={FIELD}
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder={ctx.currentKm != null ? formatKm(ctx.currentKm) : undefined}
            required={ctx.odometerWorking}
          />
        </Field>
        <Field label="Intervalo (meses)" htmlFor="oil-months">
          <Input
            id="oil-months"
            name="intervalMonths"
            inputMode="numeric"
            className={FIELD}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </Field>
        <Field label="Intervalo (km)" htmlFor="oil-interval-km">
          <Input
            id="oil-interval-km"
            name="intervalKm"
            inputMode="numeric"
            className={FIELD}
            value={intervalKm}
            onChange={(e) => setIntervalKm(e.target.value)}
          />
        </Field>
      </div>
      <p className="rounded-lg bg-muted p-2 text-sm" aria-live="polite">
        <span className="text-muted-foreground">Próximo cambio: </span>
        <span className="font-medium">{preview}</span>
      </p>
      <Field label="Notas (opcional)" htmlFor="oil-notes">
        <Textarea id="oil-notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}

export function UpdateKmForm({ plate, ctx, onDone, onCancel }: FormProps) {
  const [broken, setBroken] = useState(!ctx.odometerWorking);

  return (
    <ActionForm
      action={(fd) => updateKmAction(plate, fd)}
      submitLabel="Guardar kilometraje"
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field
        label={broken ? "Kilometraje (opcional)" : "Kilometraje actual"}
        htmlFor="km-value"
        hint={ctx.currentKm != null ? `Actual: ${formatKm(ctx.currentKm)} km. No puede bajar.` : undefined}
      >
        <Input
          id="km-value"
          name="km"
          inputMode="numeric"
          className={FIELD}
          defaultValue={ctx.currentKm != null ? String(ctx.currentKm) : ""}
          required={!broken}
        />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="odometerBroken"
          className="size-5"
          checked={broken}
          onChange={(e) => setBroken(e.target.checked)}
        />
        El odómetro no funciona
      </label>
    </ActionForm>
  );
}
