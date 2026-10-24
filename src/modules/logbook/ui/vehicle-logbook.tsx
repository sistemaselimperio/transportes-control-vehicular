"use client";

import { Disc3, Droplets, Fuel, Wrench, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { Section, SubHeading } from "@/modules/vehicles/ui/file-section";
import { useFileActions } from "@/modules/vehicles/ui/vehicle-file-actions";
import type { FuelRow, OilRow, ServiceRow, TireRow, VehicleLogbook } from "../domain/logbook";
import { FuelForm, ServiceForm, TireForm } from "./logbook-forms";
import { CompactFuel, CompactOilChanges, CompactServices, CompactTires } from "./logbook-lists";
import { NoticeToast, useNotice } from "./notice";
import { OilEditForm } from "./oil-forms";

/** The form open in the side panel: a new record of a kind, or a record being edited. */
type Form =
  | { kind: "service"; row?: ServiceRow }
  | { kind: "tire"; row?: TireRow }
  | { kind: "fuel"; row?: FuelRow }
  | { kind: "oil"; row: OilRow };

const TITLES: Record<Form["kind"], { create: string; edit: string }> = {
  service: { create: "Registrar servicio", edit: "Editar servicio" },
  tire: { create: "Registrar cambio de llantas", edit: "Editar cambio de llantas" },
  fuel: { create: "Registrar tanqueo", edit: "Editar tanqueo" },
  oil: { create: "Registrar cambio de aceite", edit: "Editar cambio de aceite" },
};

const BUTTON = "h-11 bg-transparent px-3 hover:bg-muted md:h-8";

function AddButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className={BUTTON} onClick={onClick}>
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

/**
 * The vehicle's logbook inside its file: the same four records as the Bitácora page, filtered to
 * this vehicle, as ruled lists like the rest of the file. New oil changes go through the file's own
 * oil action; the other three open a form here.
 */
export function VehicleLogbookSection({
  plate,
  sold,
  logbook,
  providers,
  today,
}: {
  plate: string;
  sold: boolean;
  logbook: VehicleLogbook;
  providers: readonly string[];
  today: IsoDate;
}) {
  const fileActions = useFileActions();
  const [form, setForm] = useState<Form | null>(null);
  const [notice, notify] = useNotice();

  const close = () => setForm(null);
  const done = (message: string) => {
    notify({ tone: "ok", text: message });
    close();
  };
  const onResult = (result: ActionResult) =>
    notify(result.ok ? { tone: "ok", text: result.message } : { tone: "error", text: result.error });
  const list = { editable: !sold, onResult };
  const formProps = { today, providers, vehicle: { plate }, onDone: done, onCancel: close };

  return (
    <Section
      id="bitacora"
      title="Bitácora"
      actions={
        sold ? undefined : (
          <div className="flex flex-wrap gap-1.5">
            <AddButton icon={Wrench} label="Servicio" onClick={() => setForm({ kind: "service" })} />
            <AddButton icon={Droplets} label="Aceite" onClick={() => fileActions.open("oil")} />
            <AddButton icon={Disc3} label="Llantas" onClick={() => setForm({ kind: "tire" })} />
            <AddButton icon={Fuel} label="Combustible" onClick={() => setForm({ kind: "fuel" })} />
          </div>
        )
      }
    >
      <SubHeading count={logbook.services.length}>Servicios</SubHeading>
      <CompactServices rows={logbook.services} {...list} onEdit={(row) => setForm({ kind: "service", row })} />
      <SubHeading count={logbook.oilChanges.length}>Cambios de aceite</SubHeading>
      <CompactOilChanges rows={logbook.oilChanges} {...list} onEdit={(row) => setForm({ kind: "oil", row })} />
      <SubHeading count={logbook.tires.length}>Llantas</SubHeading>
      <CompactTires rows={logbook.tires} {...list} onEdit={(row) => setForm({ kind: "tire", row })} />
      <SubHeading count={logbook.fuel.length}>Combustible</SubHeading>
      <CompactFuel rows={logbook.fuel} {...list} onEdit={(row) => setForm({ kind: "fuel", row })} />

      <NoticeToast notice={notice} />

      <SlideOver
        open={form !== null}
        onOpenChange={(open) => !open && close()}
        title={form ? TITLES[form.kind][form.row ? "edit" : "create"] : ""}
        description={`Vehículo ${plate}`}
      >
        {form?.kind === "service" && <ServiceForm key={form.row?.id ?? "new"} row={form.row} {...formProps} />}
        {form?.kind === "tire" && <TireForm key={form.row?.id ?? "new"} row={form.row} {...formProps} />}
        {form?.kind === "fuel" && <FuelForm key={form.row?.id ?? "new"} row={form.row} {...formProps} />}
        {form?.kind === "oil" && (
          <OilEditForm key={form.row.id} row={form.row} today={today} onDone={done} onCancel={close} />
        )}
      </SlideOver>
    </Section>
  );
}
