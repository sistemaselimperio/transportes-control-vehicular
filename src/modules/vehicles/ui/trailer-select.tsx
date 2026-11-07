"use client";

import { ActionForm, Field } from "@/components/app/action-form";
import { NativeSelect } from "@/components/ui/native-select";
import { setTrailerAction } from "../application/vehicle-actions";
import type { VehicleFormOptions } from "../application/vehicle-queries";

const SELECT = "h-10 md:h-9";

/** Trailer picker: one optional choice; the ones anchored to another tractor say so, as picking them moves them. */
export function TrailerSelect({
  id,
  trailers,
  defaultValue = "",
  label = "Remolque",
}: {
  id: string;
  trailers: VehicleFormOptions["trailers"];
  defaultValue?: string;
  label?: string;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint="Solo aparecen remolques activos o en taller. Si ya está anclado a otro vehículo, pasa a este."
    >
      <NativeSelect id={id} name="trailerPlate" className={SELECT} defaultValue={defaultValue}>
        <option value="">Sin remolque</option>
        {trailers.map((t) => (
          <option key={t.plate} value={t.plate}>
            {t.towedByPlate ? `${t.plate} (hoy en ${t.towedByPlate})` : t.plate}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** Side-panel form of the vehicle file: anchors a trailer to this tractor or clears it. */
export function AnchorTrailerForm({
  plate,
  trailers,
  current,
  onDone,
  onCancel,
}: {
  plate: string;
  trailers: VehicleFormOptions["trailers"];
  /** Plate of the trailer anchored now. */
  current: string | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  return (
    <ActionForm
      action={(fd) => {
        // The shared picker names its field for the create form; the action reads it as `trailer`.
        const trailer = String(fd.get("trailerPlate") ?? "");
        const body = new FormData();
        body.set("trailer", trailer);
        return setTrailerAction(plate, body);
      }}
      submitLabel="Guardar remolque"
      onDone={onDone}
      onCancel={onCancel}
    >
      <p className="text-sm text-muted-foreground">
        Un vehículo lleva un solo remolque. Al elegir otro, el anterior queda libre.
      </p>
      <TrailerSelect id="anchor-trailer" trailers={trailers} defaultValue={current ?? ""} />
    </ActionForm>
  );
}
