"use client";

import { ActionForm, Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { createClientAction, updateClientAction } from "../application/client-actions";
import type { ClientRow } from "../domain/client-row";

const FIELD = "h-10 md:h-9";

/** Creates a client, or edits `client` when given. */
export function ClientForm({
  client,
  onDone,
  onCancel,
}: {
  client?: ClientRow;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  return (
    <ActionForm
      action={(fd) => (client ? updateClientAction(client.id, fd) : createClientAction(fd))}
      submitLabel={client ? "Guardar cambios" : "Crear cliente"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <Field label="Nombre" htmlFor="client-name" required>
        <Input id="client-name" name="name" className={FIELD} defaultValue={client?.name ?? ""} autoComplete="off" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NIT" htmlFor="client-nit" hint="Opcional">
          <Input
            id="client-nit"
            name="nit"
            inputMode="numeric"
            className={`${FIELD} num`}
            defaultValue={client?.nit ? formatNit(client.nit) : ""}
            autoComplete="off"
          />
        </Field>
        <Field label="Teléfono" htmlFor="client-phone" hint="Opcional">
          <Input
            id="client-phone"
            name="phone"
            type="tel"
            className={`${FIELD} num`}
            defaultValue={client?.phone ?? ""}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Dirección" htmlFor="client-address" hint="Opcional">
        <Input id="client-address" name="address" className={FIELD} defaultValue={client?.address ?? ""} autoComplete="off" />
      </Field>
      <Field
        label="Link de Google Maps"
        htmlFor="client-maps"
        hint="Pega el link desde Maps. Si trae coordenadas, se usan para armar el link del conductor."
      >
        <Input
          id="client-maps"
          name="mapsUrl"
          type="url"
          inputMode="url"
          className={FIELD}
          defaultValue={client?.mapsUrl ?? ""}
          placeholder="https://maps.app.goo.gl/…"
          autoComplete="off"
        />
      </Field>
      <Field label="Notas" htmlFor="client-notes" hint="Opcional">
        <Textarea id="client-notes" name="notes" rows={3} maxLength={500} defaultValue={client?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
