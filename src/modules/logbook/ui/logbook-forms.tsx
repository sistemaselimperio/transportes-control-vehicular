"use client";

import { useId, type ReactNode } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { IsoDate } from "@/modules/shared/domain/dates";
import {
  createFuelAction,
  createServiceAction,
  createTireAction,
  updateFuelAction,
  updateServiceAction,
  updateTireAction,
} from "../application/logbook-actions";
import { SERVICE_KIND_LABELS, type FuelRow, type ServiceRow, type TireRow } from "../domain/logbook";

const FIELD = "h-10 md:h-9";

/** What every logbook form needs: today's date for `max`, the suggestions and where the record goes. */
interface FormProps {
  today: IsoDate;
  providers: readonly string[];
  /** Vehicle of a new record: a fixed plate (vehicle file) or the plates to pick from (fleet page). */
  vehicle: { plate: string } | { plates: readonly string[] };
  onDone: (message: string) => void;
  onCancel: () => void;
}

/** The vehicle of a new record. Editing a record never changes its vehicle. */
function VehicleField({ vehicle, id }: { vehicle: FormProps["vehicle"]; id: string }) {
  if ("plate" in vehicle) return <input type="hidden" name="plate" value={vehicle.plate} />;
  return (
    <Field label="Vehículo" htmlFor={id} required>
      <NativeSelect id={id} name="plate" defaultValue="" required>
        <option value="" disabled>
          Selecciona…
        </option>
        {vehicle.plates.map((plate) => (
          <option key={plate} value={plate}>
            {plate}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** Free text that suggests the providers already used (a native datalist). */
function ProviderField({
  id,
  label,
  providers,
  defaultValue,
}: {
  id: string;
  label: string;
  providers: readonly string[];
  defaultValue?: string | null;
}) {
  const listId = `${id}-list`;
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name="provider"
        list={listId}
        className={FIELD}
        autoComplete="off"
        defaultValue={defaultValue ?? ""}
        maxLength={120}
      />
      <datalist id={listId}>
        {providers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </Field>
  );
}

function DateField({ id, today, defaultValue }: { id: string; today: IsoDate; defaultValue?: IsoDate }) {
  return (
    <Field label="Fecha" htmlFor={id} required>
      <Input id={id} name="date" type="date" className={FIELD} defaultValue={defaultValue ?? today} max={today} required />
    </Field>
  );
}

function Fields({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">{children}</div>;
}

/** Creates a service, or edits `row`. */
export function ServiceForm({ row, today, providers, vehicle, onDone, onCancel }: FormProps & { row?: ServiceRow }) {
  const id = useId();
  return (
    <ActionForm
      action={(fd) => (row ? updateServiceAction(row.id, fd) : createServiceAction(fd))}
      submitLabel={row ? "Guardar cambios" : "Registrar mantenimiento"}
      onDone={onDone}
      onCancel={onCancel}
    >
      {!row && <VehicleField vehicle={vehicle} id={`${id}-plate`} />}
      <Fields>
        <DateField id={`${id}-date`} today={today} defaultValue={row?.date} />
        <Field label="Tipo" htmlFor={`${id}-kind`} required>
          <NativeSelect id={`${id}-kind`} name="kind" defaultValue={row?.kind ?? "CORRECTIVE"} required>
            {Object.entries(SERVICE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Fields>
      <Field label="Descripción" htmlFor={`${id}-description`} required>
        <Input
          id={`${id}-description`}
          name="description"
          className={FIELD}
          autoComplete="off"
          defaultValue={row?.description ?? ""}
          placeholder="Cambio de bomba de agua"
          required
        />
      </Field>
      <ProviderField id={`${id}-provider`} label="Proveedor" providers={providers} defaultValue={row?.provider} />
      <Fields>
        <Field label="Precio (opcional)" htmlFor={`${id}-price`}>
          <PesosInput id={`${id}-price`} name="price" defaultValue={row?.price} />
        </Field>
      </Fields>
      <Field label="Novedad (opcional)" htmlFor={`${id}-notes`}>
        <Textarea id={`${id}-notes`} name="notes" rows={3} defaultValue={row?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}

/** Creates a tire change, or edits `row`. */
export function TireForm({ row, today, providers, vehicle, onDone, onCancel }: FormProps & { row?: TireRow }) {
  const id = useId();
  return (
    <ActionForm
      action={(fd) => (row ? updateTireAction(row.id, fd) : createTireAction(fd))}
      submitLabel={row ? "Guardar cambios" : "Registrar llantas"}
      onDone={onDone}
      onCancel={onCancel}
    >
      {!row && <VehicleField vehicle={vehicle} id={`${id}-plate`} />}
      <Fields>
        <DateField id={`${id}-date`} today={today} defaultValue={row?.date} />
        <Field label="Cantidad" htmlFor={`${id}-quantity`} required>
          <Input
            id={`${id}-quantity`}
            name="quantity"
            inputMode="numeric"
            className={FIELD}
            defaultValue={row?.quantity ?? ""}
            required
          />
        </Field>
      </Fields>
      <Field label="Referencia" htmlFor={`${id}-reference`} required>
        <Input
          id={`${id}-reference`}
          name="reference"
          className={FIELD}
          autoComplete="off"
          defaultValue={row?.reference ?? ""}
          placeholder="295/80R22.5"
          required
        />
      </Field>
      <ProviderField id={`${id}-provider`} label="Proveedor" providers={providers} defaultValue={row?.provider} />
      <Field label="Precio (opcional)" htmlFor={`${id}-price`}>
        <PesosInput id={`${id}-price`} name="price" defaultValue={row?.price} />
      </Field>
      <Field label="Observación (opcional)" htmlFor={`${id}-notes`}>
        <Textarea id={`${id}-notes`} name="notes" rows={3} defaultValue={row?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}

/** Creates a fuel fill, or edits `row`. */
export function FuelForm({ row, today, providers, vehicle, onDone, onCancel }: FormProps & { row?: FuelRow }) {
  const id = useId();
  return (
    <ActionForm
      action={(fd) => (row ? updateFuelAction(row.id, fd) : createFuelAction(fd))}
      submitLabel={row ? "Guardar cambios" : "Registrar tanqueo"}
      onDone={onDone}
      onCancel={onCancel}
    >
      {!row && <VehicleField vehicle={vehicle} id={`${id}-plate`} />}
      <DateField id={`${id}-date`} today={today} defaultValue={row?.date} />
      <Fields>
        <Field label="Galones" htmlFor={`${id}-gallons`} required>
          <Input
            id={`${id}-gallons`}
            name="gallons"
            inputMode="decimal"
            className={`${FIELD} num`}
            autoComplete="off"
            defaultValue={row ? String(row.gallons).replace(".", ",") : ""}
            required
          />
        </Field>
        <Field label="Valor" htmlFor={`${id}-amount`} required>
          <PesosInput id={`${id}-amount`} name="amount" defaultValue={row?.amount} required />
        </Field>
      </Fields>
      <ProviderField id={`${id}-provider`} label="Estación" providers={providers} defaultValue={row?.provider} />
    </ActionForm>
  );
}
