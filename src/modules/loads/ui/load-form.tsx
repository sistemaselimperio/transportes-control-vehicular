"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { createLoadAction, updateLoadAction } from "../application/load-actions";
import { NOTES_MAX, REFERENCE_MAX } from "../application/load-schemas";
import { LOAD_SUPPLIERS, type LoadRow } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

/** Creates a load, or edits `load` when given. */
export function LoadForm({
  load,
  plates,
  onDone,
  onCancel,
}: {
  load?: LoadRow;
  /** Plates of the registered fleet: the only ones that can be picked. */
  plates: readonly string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = load && !plates.includes(load.plate) ? [load.plate, ...plates] : plates;

  return (
    <ActionForm
      action={(fd) => (load ? updateLoadAction(load.id, fd) : createLoadAction(fd))}
      submitLabel={load ? "Guardar cambios" : "Registrar cargue"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="load-date" required>
          <Input id="load-date" name="date" type="date" className={FIELD} defaultValue={load?.date ?? today} required />
        </Field>
        <Field label="Proveedor" htmlFor="load-supplier" required>
          <NativeSelect id="load-supplier" name="supplier" defaultValue={load?.supplier ?? ""} required>
            <option value="" disabled>
              Elige un proveedor
            </option>
            {LOAD_SUPPLIERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placa" htmlFor="load-plate" required>
          <NativeSelect id="load-plate" name="plate" defaultValue={load?.plate ?? ""} required>
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
        <Field label="Toneladas" htmlFor="load-tons" required>
          <Input
            id="load-tons"
            name="tons"
            inputMode="decimal"
            className={`${FIELD} num`}
            defaultValue={load ? String(load.tons) : ""}
            autoComplete="off"
            required
          />
        </Field>
      </div>
      <Field label="Costo (COP)" htmlFor="load-cost" required>
        <PesosInput id="load-cost" name="cost" defaultValue={load?.cost} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número SIESA" htmlFor="load-siesa" required hint="No se puede repetir.">
          <Input
            id="load-siesa"
            name="siesaNumber"
            className={`${FIELD} num`}
            defaultValue={load?.siesaNumber ?? ""}
            maxLength={REFERENCE_MAX}
            autoComplete="off"
            required
          />
        </Field>
        <Field label="Número de pedido" htmlFor="load-order" required>
          <Input
            id="load-order"
            name="orderNumber"
            className={`${FIELD} num`}
            defaultValue={load?.orderNumber ?? ""}
            maxLength={REFERENCE_MAX}
            autoComplete="off"
            required
          />
        </Field>
      </div>
      <Field label="Observación" htmlFor="load-notes" hint="Opcional">
        <Textarea id="load-notes" name="notes" rows={3} maxLength={NOTES_MAX} defaultValue={load?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
