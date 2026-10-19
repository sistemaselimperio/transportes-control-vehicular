"use client";

import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createDriverAction, updateDriverAction } from "../application/driver-actions";
import { COMPANY_LABELS, DRIVER_STATUS_LABELS, type DriverRow } from "../domain/driver-row";

const FIELD = "h-10 md:h-9";

/** Creates a driver, or edits `driver` when given. */
export function DriverForm({
  driver,
  onDone,
  onCancel,
}: {
  driver?: DriverRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  return (
    <ActionForm
      action={(fd) => (driver ? updateDriverAction(driver.id, fd) : createDriverAction(fd))}
      submitLabel={driver ? "Guardar cambios" : "Crear conductor"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Nombre completo" htmlFor="drv-name" hint="Apellidos y nombres, como en la cédula.">
        <Input id="drv-name" name="name" className={FIELD} defaultValue={driver?.name} autoComplete="off" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cédula (opcional)" htmlFor="drv-national">
          <Input
            id="drv-national"
            name="nationalId"
            inputMode="numeric"
            className={FIELD}
            defaultValue={driver?.nationalId ?? ""}
          />
        </Field>
        <Field label="Celular (opcional)" htmlFor="drv-phone">
          <Input id="drv-phone" name="phone" type="tel" className={FIELD} defaultValue={driver?.phone ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Empresa" htmlFor="drv-company">
          <NativeSelect id="drv-company" name="company" defaultValue={driver?.company ?? ""}>
            <option value="">Sin empresa</option>
            {Object.entries(COMPANY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Estado" htmlFor="drv-status">
          <NativeSelect id="drv-status" name="status" defaultValue={driver?.status ?? "ACTIVE"}>
            {Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </ActionForm>
  );
}
