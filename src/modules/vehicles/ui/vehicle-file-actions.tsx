"use client";

import { Menu } from "@base-ui/react/menu";
import {
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  Droplets,
  Gauge,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Power,
  Receipt,
  UserRound,
} from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { VehicleActionContext, VehicleDetail } from "../application/vehicle-queries";
import {
  ChangeStatusForm,
  OilChangeForm,
  RenewDocumentForm,
  UpdateKmForm,
  UpdateTaxForm,
} from "./vehicle-action-forms";
import { EditVehicleForm } from "./vehicle-form";
import { AssignDriverForm, SellForm, TransferOwnerForm } from "./vehicle-people-forms";

export type ActionKey =
  | "edit"
  | "document"
  | "tax"
  | "oil"
  | "km"
  | "status"
  | "driver"
  | "owner"
  | "sell";

const ACTIONS: Record<
  ActionKey,
  { label: string; title: string; icon: ComponentType<{ className?: string }> }
> = {
  edit: { label: "Editar datos", title: "Editar datos del vehículo", icon: Pencil },
  document: { label: "Renovar documento", title: "Renovar documento", icon: CalendarClock },
  tax: { label: "Impuesto", title: "Actualizar impuesto", icon: Receipt },
  oil: { label: "Cambio de aceite", title: "Registrar cambio de aceite", icon: Droplets },
  km: { label: "Kilometraje", title: "Actualizar kilometraje", icon: Gauge },
  status: { label: "Cambiar estado", title: "Cambiar estado", icon: Power },
  driver: { label: "Asignar conductor", title: "Asignar conductor", icon: UserRound },
  owner: { label: "Traspasar", title: "Traspasar propietario", icon: ArrowRightLeft },
  sell: { label: "Vender", title: "Vender vehículo", icon: HandCoins },
};

interface FileActionsContext {
  sold: boolean;
  open: (key: ActionKey) => void;
}

const Ctx = createContext<FileActionsContext | null>(null);

function useFileActions() {
  const value = useContext(Ctx);
  if (!value) throw new Error("File action controls must sit inside <FileActions>");
  return value;
}

/**
 * Owns the one side panel of the vehicle file. Buttons anywhere below
 * (`ActionButtons`, `OverflowMenu`) open it through context, so the page itself
 * stays a server component.
 */
export function FileActions({
  plate,
  status,
  ctx,
  edit,
  children,
}: {
  plate: string;
  status: VehicleStatus;
  ctx: VehicleActionContext;
  edit: VehicleDetail["edit"];
  children: ReactNode;
}) {
  const [active, setActive] = useState<ActionKey | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const close = () => setOpen(false);
  const common = {
    plate,
    ctx,
    onCancel: close,
    onDone: (msg: string) => {
      setMessage(msg);
      setTimeout(() => setMessage(null), 6000);
      close();
    },
  };

  return (
    <Ctx.Provider
      value={{
        sold: status === "SOLD",
        open: (key) => {
          setMessage(null);
          setActive(key);
          setOpen(true);
        },
      }}
    >
      {children}

      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground shadow-soft"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={active ? ACTIONS[active].title : ""}
        description={`Vehículo ${plate}`}
        wide={active === "edit"}
      >
        {active === "edit" && (
          <EditVehicleForm
            values={edit.values}
            options={edit.options}
            onCancel={close}
            onDone={common.onDone}
            otherActions={<EditShortcuts onOpen={setActive} />}
          />
        )}
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
      </SlideOver>
    </Ctx.Provider>
  );
}

const EDIT_SHORTCUTS: readonly ActionKey[] = ["owner", "driver", "document", "tax", "km", "oil", "status"];

/** Inside "Editar datos": jumps the open panel straight to another action. */
function EditShortcuts({ onOpen }: { onOpen: (key: ActionKey) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
      {EDIT_SHORTCUTS.map((key) => {
        const { label, icon: Icon } = ACTIONS[key];
        return (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-11 justify-start px-3.5"
            onClick={() => onOpen(key)}
          >
            <Icon aria-hidden />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

/** The actions that belong to one tab. Sold vehicles get the read-only notice instead. */
export function ActionButtons({ keys }: { keys: readonly ActionKey[] }) {
  const { sold, open } = useFileActions();
  if (sold) return <SoldNotice />;
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => {
        const { label, icon: Icon } = ACTIONS[key];
        return (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-11 px-3.5 md:h-9"
            onClick={() => open(key)}
          >
            <Icon aria-hidden />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

export function SoldNotice() {
  return (
    <p className="rounded-xl border border-dashed bg-card/60 px-4 py-3 text-sm text-muted-foreground">
      Vehículo vendido: ya no admite cambios.
    </p>
  );
}

/** Header button for editing the vehicle's own data; hidden once sold. */
export function EditDataButton() {
  const { sold, open } = useFileActions();
  if (sold) return null;
  const { label, icon: Icon } = ACTIONS.edit;
  return (
    <Button type="button" variant="outline" className="h-11 px-3.5 md:h-9" onClick={() => open("edit")}>
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

/** Header overflow: the destructive action lives here, away from daily ones. */
export function OverflowMenu() {
  const { sold, open } = useFileActions();
  if (sold) return null;
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Más acciones"
        className="flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground md:size-9"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-52 rounded-xl border bg-popover p-1 shadow-soft outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Menu.Item
              onClick={() => requestAnimationFrame(() => open("sell"))}
              className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-3 text-sm text-destructive outline-none data-highlighted:bg-destructive/10"
            >
              <HandCoins className="size-4" aria-hidden />
              Vender vehículo
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
