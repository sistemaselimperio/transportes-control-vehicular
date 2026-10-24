"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { loadActionContextAction } from "@/modules/vehicles/application/vehicle-actions";
import type { VehicleActionContext } from "@/modules/vehicles/application/vehicle-queries";
import { OilChangeForm } from "@/modules/vehicles/ui/vehicle-action-forms";
import type { OilRow } from "../domain/logbook";

/** Edits a registered oil change; the vehicle data it needs to recompute the next change rides on the row. */
export function OilEditForm({
  row,
  today,
  onDone,
  onCancel,
}: {
  row: OilRow;
  today: IsoDate;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  return (
    <OilChangeForm
      plate={row.plate}
      editing={row}
      ctx={{
        today,
        odometerWorking: row.odometerWorking,
        currentKm: row.currentKm,
        oilMode: row.oilMode,
        oilInterval: { months: row.intervalMonths, km: row.intervalKm },
        lastOilItems: [],
      }}
      onDone={onDone}
      onCancel={onCancel}
    />
  );
}

/**
 * Registers an oil change from the fleet-wide page: pick the vehicle first, then reuse the same
 * form as the vehicle file (it starts from the vehicle's previous supplies).
 */
export function OilCreateFlow({
  plates,
  onDone,
  onCancel,
}: {
  plates: readonly string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [plate, setPlate] = useState("");
  const [ctx, setCtx] = useState<VehicleActionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (ctx) return <OilChangeForm plate={plate} ctx={ctx} onDone={onDone} onCancel={onCancel} />;

  return (
    <div className="space-y-4 px-5 py-5">
      <Field label="Vehículo" htmlFor="oil-create-plate" required>
        <NativeSelect id="oil-create-plate" value={plate} onChange={(e) => setPlate(e.target.value)}>
          <option value="" disabled>
            Selecciona…
          </option>
          {plates.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="h-11 px-4 md:h-10"
          disabled={plate === "" || pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const loaded = await loadActionContextAction(plate);
              if (loaded) setCtx(loaded);
              else setError("No se pudieron cargar los datos del vehículo.");
            })
          }
        >
          {pending ? "Cargando…" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
