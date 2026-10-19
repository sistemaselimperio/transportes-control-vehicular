"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  Droplets,
  Gauge,
  HandCoins,
  Power,
  Receipt,
  UserRound,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { Modal } from "@/components/app/modal";
import { Button } from "@/components/ui/button";
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { VehicleActionContext } from "../application/vehicle-queries";
import {
  ChangeStatusForm,
  OilChangeForm,
  RenewDocumentForm,
  UpdateKmForm,
  UpdateTaxForm,
} from "./vehicle-action-forms";
import { AssignDriverForm, SellForm, TransferOwnerForm } from "./vehicle-people-forms";

type ActionKey =
  | "document"
  | "tax"
  | "oil"
  | "km"
  | "status"
  | "driver"
  | "owner"
  | "sell";

const ACTIONS: Array<{
  key: ActionKey;
  label: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "document", label: "Renovar documento", title: "Renovar documento", icon: CalendarClock },
  { key: "tax", label: "Impuesto", title: "Actualizar impuesto", icon: Receipt },
  { key: "oil", label: "Cambio de aceite", title: "Registrar cambio de aceite", icon: Droplets },
  { key: "km", label: "Kilometraje", title: "Actualizar kilometraje", icon: Gauge },
  { key: "status", label: "Cambiar estado", title: "Cambiar estado", icon: Power },
  { key: "driver", label: "Asignar conductor", title: "Asignar conductor", icon: UserRound },
  { key: "owner", label: "Traspasar", title: "Traspasar propietario", icon: ArrowRightLeft },
  { key: "sell", label: "Vender", title: "Vender vehículo", icon: HandCoins },
];

/** Action buttons of the detail page; each opens its form in a modal. */
export function VehicleActionsBar({
  plate,
  status,
  ctx,
}: {
  plate: string;
  status: VehicleStatus;
  ctx: VehicleActionContext;
}) {
  const [active, setActive] = useState<ActionKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (status === "SOLD") {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Vehículo vendido: ya no admite cambios.
      </p>
    );
  }

  const close = () => setActive(null);
  const common = {
    plate,
    ctx,
    onCancel: close,
    onDone: (msg: string) => {
      setMessage(msg);
      close();
    },
  };
  const current = ACTIONS.find((a) => a.key === active);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            variant={key === "sell" ? "destructive" : "outline"}
            className="h-11 justify-start px-3 md:h-9"
            onClick={() => {
              setMessage(null);
              setActive(key);
            }}
          >
            <Icon aria-hidden />
            {label}
          </Button>
        ))}
      </div>
      {message && (
        <p role="status" className="rounded-lg bg-muted p-2 text-sm">
          {message}
        </p>
      )}

      <Modal open={active !== null} onClose={close} title={current?.title ?? ""}>
        {active === "document" && <RenewDocumentForm {...common} />}
        {active === "tax" && <UpdateTaxForm {...common} />}
        {active === "oil" && <OilChangeForm {...common} />}
        {active === "km" && <UpdateKmForm {...common} />}
        {active === "status" && (
          <ChangeStatusForm
            plate={plate}
            status={status}
            onCancel={close}
            onDone={common.onDone}
          />
        )}
        {active === "driver" && <AssignDriverForm {...common} />}
        {active === "owner" && <TransferOwnerForm {...common} />}
        {active === "sell" && <SellForm {...common} />}
      </Modal>
    </div>
  );
}
