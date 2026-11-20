"use client";

import { AlertTriangle } from "lucide-react";
import { useState, useTransition } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { parseDecimal } from "@/modules/shared/domain/decimal";
import { createDeliveryAction, updateDeliveryAction } from "../application/delivery-actions";
import { NOTES_MAX } from "../application/delivery-schemas";
import type { DestinationRow } from "../application/delivery-queries";
import { formatTons } from "../domain/delivery-format";
import { DELIVERY_PRIORITY_LABELS, DELIVERY_PRIORITIES, DELIVERY_SHIFTS, isSunday, type DeliveryRow } from "../domain/delivery-rules";
import { ClientPicker, type ClientOption } from "./client-picker";

const FIELD = "h-10 md:h-9";

export interface DeliveryFormOptions {
  clients: readonly ClientOption[];
  destinations: readonly DestinationRow[];
  /** Plates of the fleet: the only ones that can be picked. */
  plates: readonly string[];
}

/** The controls of a delivery, shared by the inline "Registrar" form and the edit sheet. */
function DeliveryFields({
  idPrefix,
  options,
  delivery,
  date,
  onDateChange,
  defaultShift,
}: {
  idPrefix: string;
  options: DeliveryFormOptions;
  delivery?: DeliveryRow;
  date: string;
  onDateChange: (date: string) => void;
  defaultShift?: string;
}) {
  const [weight, setWeight] = useState(delivery ? String(delivery.weightKg) : "");
  const [clientId, setClientId] = useState<number | null>(delivery?.clientId ?? null);
  const locations = options.clients.find((c) => c.id === clientId)?.locations ?? [];
  const kg = parseDecimal(weight);
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = delivery?.plate && !options.plates.includes(delivery.plate) ? [delivery.plate, ...options.plates] : options.plates;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor={`${idPrefix}-date`} required>
          <Input
            id={`${idPrefix}-date`}
            name="date"
            type="date"
            className={FIELD}
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            required
          />
        </Field>
        <Field label="Turno" htmlFor={`${idPrefix}-shift`} required>
          <NativeSelect id={`${idPrefix}-shift`} name="shift" defaultValue={delivery?.shift ?? defaultShift ?? DELIVERY_SHIFTS[0]} required>
            {DELIVERY_SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {isSunday(date) && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-warn px-3 py-2 text-sm text-warn-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Los domingos no se hacen entregas. Puedes guardarla de todos modos.
        </p>
      )}
      <Field label="Prioridad" htmlFor={`${idPrefix}-priority`}>
        <NativeSelect id={`${idPrefix}-priority`} name="priority" defaultValue={delivery?.priority ?? "normal"}>
          {DELIVERY_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {DELIVERY_PRIORITY_LABELS[p]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Cliente" htmlFor={`${idPrefix}-client`} required>
        <ClientPicker
          id={`${idPrefix}-client`}
          clients={options.clients}
          defaultClientId={delivery?.clientId}
          onChange={setClientId}
        />
      </Field>
      {locations.length > 0 && (
        <Field label="Finca" htmlFor={`${idPrefix}-location`} hint="Opcional">
          <NativeSelect
            // A new client brings its own fincas: start over instead of keeping the previous choice.
            key={clientId}
            id={`${idPrefix}-location`}
            name="locationId"
            defaultValue={delivery && delivery.clientId === clientId && delivery.locationId ? String(delivery.locationId) : ""}
          >
            <option value="">Sin finca</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label="Destino" htmlFor={`${idPrefix}-destination`} required>
        <NativeSelect id={`${idPrefix}-destination`} name="destinationId" defaultValue={delivery ? String(delivery.destinationId) : ""} required>
          <option value="" disabled>
            Elige un destino
          </option>
          {options.destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cantidad (bultos)" htmlFor={`${idPrefix}-quantity`} required>
          <Input
            id={`${idPrefix}-quantity`}
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className={`${FIELD} num`}
            defaultValue={delivery?.quantity ?? ""}
            required
          />
        </Field>
        <Field
          label="Peso (kg)"
          htmlFor={`${idPrefix}-weight`}
          required
          hint={kg !== null && kg > 0 ? `${formatTons(kg)} toneladas` : "Se digita a mano."}
        >
          <Input
            id={`${idPrefix}-weight`}
            name="weightKg"
            inputMode="decimal"
            className={`${FIELD} num`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            autoComplete="off"
            required
          />
        </Field>
      </div>
      <Field label="Vehículo" htmlFor={`${idPrefix}-plate`} hint="Opcional">
        <NativeSelect id={`${idPrefix}-plate`} name="plate" defaultValue={delivery?.plate ?? ""}>
          <option value="">Sin vehículo</option>
          {plateOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Observación" htmlFor={`${idPrefix}-notes`} hint="Opcional">
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={2} maxLength={NOTES_MAX} defaultValue={delivery?.notes ?? ""} />
      </Field>
    </>
  );
}

/** The "Registrar" tab form: sits in the page, and starts over after each saved delivery. */
export function DeliveryInlineForm({
  options,
  date,
  onDateChange,
  onDone,
}: {
  options: DeliveryFormOptions;
  /** The day being registered; the page lists that day's deliveries beside the form. */
  date: string;
  onDateChange: (date: string) => void;
  onDone: (message: string) => void;
}) {
  const [formKey, setFormKey] = useState(0);
  const [lastShift, setLastShift] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      key={formKey}
      data-slot="inline-delivery-form"
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await createDeliveryAction(fd);
          if (result.ok) {
            const shift = fd.get("shift");
            setLastShift(typeof shift === "string" ? shift : undefined);
            setFormKey((k) => k + 1);
            onDone(result.message);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="plate-head">
        <span className="micro-label">Nueva entrega</span>
      </div>
      <div className="space-y-4 p-4">
        <DeliveryFields idPrefix="delivery-new" options={options} date={date} onDateChange={onDateChange} defaultShift={lastShift} />
        {error && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full px-4 md:h-10" disabled={pending}>
          {pending ? "Guardando…" : "Registrar entrega"}
        </Button>
      </div>
    </form>
  );
}

/** Edits `delivery` in a side sheet. */
export function DeliveryEditForm({
  delivery,
  options,
  onDone,
  onCancel,
}: {
  delivery: DeliveryRow;
  options: DeliveryFormOptions;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(delivery.date);
  return (
    <ActionForm
      action={(fd) => updateDeliveryAction(delivery.id, fd)}
      submitLabel="Guardar cambios"
      onDone={onDone}
      onCancel={onCancel}
    >
      <DeliveryFields idPrefix="delivery-edit" options={options} delivery={delivery} date={date} onDateChange={setDate} />
    </ActionForm>
  );
}
