"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { MunicipalityPicker } from "@/modules/shared/ui/municipality-picker";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createTripAction, updateTripAction } from "../application/trip-actions";
import { TRIP_AREAS } from "../domain/trip-areas";
import { currentLocalInput, toLocalInput } from "../domain/trip-datetime";
import type { TripRow } from "../domain/trip-row";
import { allowedNextStatuses, TRIP_STATUS_LABELS, TRIP_STATUSES } from "../domain/trip-status";

const FIELD = "h-10 md:h-9";

/** Creates a trip, or edits `trip` when given. */
export function TripForm({
  trip,
  plates,
  onDone,
  onCancel,
}: {
  trip?: TripRow;
  /** Plates of the registered fleet: the only ones that can be picked. */
  plates: readonly string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "now" is read on the client at that moment.
  const [startAt] = useState(() => (trip ? toLocalInput(new Date(trip.startAt)) : currentLocalInput()));
  // The stored plate stays selectable when its vehicle was deleted.
  const plateOptions = trip && !plates.includes(trip.plate) ? [trip.plate, ...plates] : plates;
  const statuses = trip ? allowedNextStatuses(trip.status) : TRIP_STATUSES;

  return (
    <ActionForm
      action={(fd) => (trip ? updateTripAction(trip.id, fd) : createTripAction(fd))}
      submitLabel={trip ? "Guardar cambios" : "Registrar viaje"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Fecha inicio" htmlFor="trip-start" required>
        <Input
          id="trip-start"
          name="startAt"
          type="datetime-local"
          className={FIELD}
          defaultValue={startAt}
          required
        />
      </Field>
      {/* The route as a timeline: a rail runs from the departure point down to the arrival pin. */}
      <div className="flex flex-col">
        <fieldset className="relative grid grid-cols-[1.5rem_1fr] gap-x-3 pb-4">
          <legend className="sr-only">Salida</legend>
          <span aria-hidden className="relative flex justify-center pt-0.5">
            <span className="z-10 size-3.5 rounded-full border-[3px] border-foreground bg-background" />
            <span className="absolute top-5 -bottom-4 w-0.5 border-l-2 border-dashed border-muted-foreground/50" />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <p aria-hidden className="micro-label">Salida</p>
            <div className="grid grid-cols-2 gap-3">
              <MunicipalityPicker
                idPrefix="trip-origin"
                name="origin"
                defaultValue={trip?.origin}
                selectClassName={FIELD}
                required
              />
            </div>
          </div>
        </fieldset>
        <fieldset className="grid grid-cols-[1.5rem_1fr] gap-x-3">
          <legend className="sr-only">Destino</legend>
          <span aria-hidden className="flex justify-center">
            <MapPin className="z-10 size-5 fill-primary/20 text-primary" strokeWidth={2.25} />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <p aria-hidden className="micro-label">Destino</p>
            <div className="grid grid-cols-2 gap-3">
              <MunicipalityPicker
                idPrefix="trip-destination"
                name="destination"
                defaultValue={trip?.destination}
                selectClassName={FIELD}
                required
              />
            </div>
          </div>
        </fieldset>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placa" htmlFor="trip-plate" required>
          <NativeSelect id="trip-plate" name="plate" defaultValue={trip?.plate ?? ""} required>
            <option value="" disabled>
              Elige una placa
            </option>
            {plateOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Área" htmlFor="trip-area" required>
          <NativeSelect id="trip-area" name="area" defaultValue={trip?.area ?? ""} required>
            <option value="" disabled>
              Elige un área
            </option>
            {TRIP_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field
        label="Estado"
        htmlFor="trip-status"
        hint={trip ? "El estado solo avanza: no se puede volver a uno anterior." : undefined}
      >
        <NativeSelect id="trip-status" name="status" defaultValue={trip?.status ?? "programado"}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {TRIP_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </ActionForm>
  );
}
