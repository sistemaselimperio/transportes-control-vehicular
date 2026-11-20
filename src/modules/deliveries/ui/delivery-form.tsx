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

/** The controls of a delivery, shared by the "Registrar entrega" sheet and the edit sheet. */
function DeliveryFields({
  idPrefix,
  options,
  delivery,
  date,
  onDateChange,
  defaultShift,
  defaultPlate,
}: {
  idPrefix: string;
  options: DeliveryFormOptions;
  delivery?: DeliveryRow;
  date: string;
  onDateChange: (date: string) => void;
  defaultShift?: string;
  defaultPlate?: string;
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
      <Field label="Vehículo" htmlFor={`${idPrefix}-plate`} required>
        <NativeSelect id={`${idPrefix}-plate`} name="plate" defaultValue={delivery?.plate ?? defaultPlate ?? ""} required>
          <option value="" disabled>
            Elige un vehículo
          </option>
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

/**
 * The "Registrar entrega" sheet form. "Registrar" saves and closes the sheet; "Registrar y otra" saves,
 * starts the form over keeping the date, trip and vehicle, and stays open.
 */
export function DeliveryCreateForm({
  options,
  today,
  onDone,
  onClose,
}: {
  options: DeliveryFormOptions;
  /** Colombia's current day: the date the form starts on. */
  today: string;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [formKey, setFormKey] = useState(0);
  const [date, setDate] = useState(today);
  const [lastShift, setLastShift] = useState<string | undefined>();
  const [lastPlate, setLastPlate] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"close" | "another" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      key={formKey}
      data-slot="action-form"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const mode = submitter?.value === "another" ? "another" : "close";
        const fd = new FormData(e.currentTarget);
        setError(null);
        setPendingMode(mode);
        startTransition(async () => {
          const result = await createDeliveryAction(fd);
          if (result.ok) {
            if (mode === "another") {
              const shift = fd.get("shift");
              const plate = fd.get("plate");
              setLastShift(typeof shift === "string" ? shift : undefined);
              setLastPlate(typeof plate === "string" ? plate : undefined);
              setFormKey((k) => k + 1);
              onDone(result.message);
            } else {
              onDone(result.message);
              onClose();
            }
          } else {
            setError(result.error);
          }
          setPendingMode(null);
        });
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        <DeliveryFields
          idPrefix="delivery-new"
          options={options}
          date={date}
          onDateChange={setDate}
          defaultShift={lastShift}
          defaultPlate={lastPlate}
        />
      </div>
      <div className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" className="h-11 px-4 md:h-10" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" name="mode" value="another" variant="outline" className="h-11 px-4 md:h-10" disabled={pending}>
            {pending && pendingMode === "another" ? "Guardando…" : "Registrar y otra"}
          </Button>
          <Button type="submit" name="mode" value="close" className="h-11 px-4 md:h-10" disabled={pending}>
            {pending && pendingMode === "close" ? "Guardando…" : "Registrar"}
          </Button>
        </div>
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
