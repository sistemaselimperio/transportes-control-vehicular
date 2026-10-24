"use client";

import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { GROUP_LABELS } from "@/modules/dashboard/domain/dashboard-metrics";
import { createOwnerAction, updateOwnerAction } from "../application/owner-actions";
import { OWNER_GROUPS, type OwnerRow } from "../domain/owner-row";

const FIELD = "h-10 md:h-9";

/** Creates an owner, or edits `owner` when given. */
export function OwnerForm({
  owner,
  onDone,
  onCancel,
}: {
  owner?: OwnerRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  return (
    <ActionForm
      action={(fd) => (owner ? updateOwnerAction(owner.id, fd) : createOwnerAction(fd))}
      submitLabel={owner ? "Guardar cambios" : "Crear propietario"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Nombre" htmlFor="own-name" hint="Persona o empresa, como figura en la tarjeta de propiedad.">
        <Input id="own-name" name="name" className={FIELD} defaultValue={owner?.name} autoComplete="off" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Documento (opcional)" htmlFor="own-document" hint="Cédula o NIT, solo números.">
          <Input
            id="own-document"
            name="documentNumber"
            inputMode="numeric"
            className={FIELD}
            defaultValue={owner?.documentNumber ?? ""}
          />
        </Field>
        <Field label="Grupo" htmlFor="own-group">
          <NativeSelect id="own-group" name="group" defaultValue={owner?.group ?? "THIRD_PARTY"}>
            {OWNER_GROUPS.map((value) => (
              <option key={value} value={value}>
                {GROUP_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </ActionForm>
  );
}
