"use client";

import { useId, useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DateField, FIELD, Fields, ProviderField } from "@/modules/logbook/ui/logbook-forms";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { createTireEventAction, updateTireEventAction } from "../application/tire-event-actions";
import {
  TIRE_CONDITION_LABELS,
  TIRE_EVENT_TYPES,
  type TireCondition,
  type TireEventRow,
  type TireEventType,
} from "../domain/tire-events";
import { positionLabel, TIRE_POSITIONS, type TirePosition } from "../domain/tire-positions";

const decimalText = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Registers an event on one position of a trailer, or edits `row`. The event type decides which
 * fields show; only those are submitted. An existing event keeps its type.
 */
export function TireEventForm({
  plate,
  position,
  today,
  providers,
  row,
  onDone,
  onCancel,
}: {
  plate: string;
  /** Position the event is registered on; an edited event keeps its own. */
  position: TirePosition;
  today: IsoDate;
  providers: readonly string[];
  row?: TireEventRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [type, setType] = useState<TireEventType>(row?.type ?? "CHANGE");
  const own = row?.position ?? position;
  const provider = row && (row.type === "CHANGE" || row.type === "REPAIR") ? row.provider : null;
  const price = row && (row.type === "CHANGE" || row.type === "REPAIR") ? row.price : null;

  return (
    <ActionForm
      action={(fd) => (row ? updateTireEventAction(row.id, fd) : createTireEventAction(fd))}
      submitLabel={row ? "Guardar cambios" : "Registrar"}
      onDone={onDone}
      onCancel={onCancel}
    >
      {!row && <input type="hidden" name="plate" value={plate} />}
      <input type="hidden" name="position" value={own} />
      <input type="hidden" name="type" value={type} />
      <p className="text-sm text-muted-foreground">{positionLabel(own)}</p>

      <Fields>
        <DateField id={`${id}-date`} today={today} defaultValue={row?.date} />
        <Field label="Tipo de evento" htmlFor={`${id}-type`} required>
          <NativeSelect
            id={`${id}-type`}
            value={type}
            disabled={row !== undefined}
            onChange={(e) => setType(e.target.value as TireEventType)}
          >
            {TIRE_EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Fields>

      {type === "CHANGE" && (
        <Field label="Referencia de la llanta" htmlFor={`${id}-reference`} required>
          <Input
            id={`${id}-reference`}
            name="reference"
            className={FIELD}
            autoComplete="off"
            defaultValue={row?.type === "CHANGE" ? row.reference : ""}
            placeholder="Llanta 295/80R22.5 Doublecoin RT606"
            required
          />
        </Field>
      )}

      {type === "ROTATION" && (
        <Field label="Rota con la posición" htmlFor={`${id}-counterpart`} required>
          <NativeSelect
            id={`${id}-counterpart`}
            name="counterpart"
            defaultValue={row?.type === "ROTATION" ? row.counterpart : ""}
            required
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {TIRE_POSITIONS.filter((p) => p.code !== own).map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      {(type === "CHANGE" || type === "REPAIR") && (
        <>
          <ProviderField id={`${id}-provider`} label="Proveedor" providers={providers} defaultValue={provider} />
          <Field label="Precio (opcional)" htmlFor={`${id}-price`}>
            <PesosInput id={`${id}-price`} name="price" defaultValue={price} />
          </Field>
        </>
      )}

      {type === "INSPECTION" && (
        <>
          <Fields>
            <Field label="Profundidad (mm)" htmlFor={`${id}-tread`}>
              <Input
                id={`${id}-tread`}
                name="treadDepthMm"
                inputMode="decimal"
                className={`${FIELD} num`}
                autoComplete="off"
                defaultValue={row?.type === "INSPECTION" ? decimalText(row.treadDepthMm) : ""}
              />
            </Field>
            <Field label="Presión (psi)" htmlFor={`${id}-pressure`}>
              <Input
                id={`${id}-pressure`}
                name="pressurePsi"
                inputMode="decimal"
                className={`${FIELD} num`}
                autoComplete="off"
                defaultValue={row?.type === "INSPECTION" ? decimalText(row.pressurePsi) : ""}
              />
            </Field>
          </Fields>
          <Field label="Estado" htmlFor={`${id}-condition`} hint="Registra al menos una medición o el estado.">
            <NativeSelect
              id={`${id}-condition`}
              name="condition"
              defaultValue={row?.type === "INSPECTION" ? (row.condition ?? "") : ""}
            >
              <option value="">Sin evaluar</option>
              {(Object.entries(TIRE_CONDITION_LABELS) as Array<[TireCondition, string]>).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </>
      )}

      <Field
        label={type === "REPAIR" ? "Descripción" : "Observación (opcional)"}
        htmlFor={`${id}-notes`}
        required={type === "REPAIR"}
      >
        <Textarea
          id={`${id}-notes`}
          name="notes"
          rows={3}
          defaultValue={row?.notes ?? ""}
          placeholder={type === "REPAIR" ? "Parche por pinchazo" : undefined}
          required={type === "REPAIR"}
        />
      </Field>
    </ActionForm>
  );
}
