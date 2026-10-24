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
 * Registers an oil change from the fleet-wide page: picking the vehicle loads its data and shows
 * the same form as the vehicle file below the picker.
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

  const pick = (next: string) => {
    setPlate(next);
    setCtx(null);
    setError(null);
    startTransition(async () => {
      const loaded = await loadActionContextAction(next);
      if (loaded) setCtx(loaded);
      else setError("No se pudieron cargar los datos del vehículo.");
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-5 pt-5">
        <Field label="Vehículo" htmlFor="oil-create-plate" required>
          <NativeSelect id="oil-create-plate" value={plate} disabled={pending} onChange={(e) => pick(e.target.value)}>
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
        {pending && <p className="text-sm text-muted-foreground">Cargando datos del vehículo…</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {ctx && !pending ? (
        <OilChangeForm key={plate} plate={plate} ctx={ctx} onDone={onDone} onCancel={onCancel} />
      ) : (
        <div className="flex justify-end px-5 py-5">
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
