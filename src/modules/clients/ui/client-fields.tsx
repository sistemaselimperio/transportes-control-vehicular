"use client";

import { useId, type Ref } from "react";
import { Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { CLIENT_NAME_MAX } from "../application/client-schemas";
import type { ClientRow } from "../domain/client-row";

const FIELD = "h-10 md:h-9";

/** The client's own fields, shared by the create sheet and the in-place editor. */
export function ClientFields({
  client,
  firstFieldRef,
}: {
  client?: ClientRow;
  /** Lets the owner move focus to the name when the editor opens. */
  firstFieldRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <>
      <Field label="Nombre" htmlFor={`${id}-name`} required>
        <Input
          ref={firstFieldRef}
          id={`${id}-name`}
          name="name"
          className={FIELD}
          defaultValue={client?.name ?? ""}
          maxLength={CLIENT_NAME_MAX}
          autoComplete="off"
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NIT" htmlFor={`${id}-nit`} hint="Opcional">
          <Input
            id={`${id}-nit`}
            name="nit"
            inputMode="numeric"
            className={`${FIELD} num`}
            defaultValue={client?.nit ? formatNit(client.nit) : ""}
            autoComplete="off"
          />
        </Field>
        <Field label="Teléfono" htmlFor={`${id}-phone`} hint="Opcional">
          <Input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            className={`${FIELD} num`}
            defaultValue={client?.phone ?? ""}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Notas" htmlFor={`${id}-notes`} hint="Opcional">
        <Textarea id={`${id}-notes`} name="notes" rows={3} maxLength={500} defaultValue={client?.notes ?? ""} />
      </Field>
    </>
  );
}
