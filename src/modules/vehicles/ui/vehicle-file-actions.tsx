"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Droplets,
  Gauge,
  HandCoins,
  Pencil,
  Receipt,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  createContext,
  useContext,
  useOptimistic,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VehicleStatus } from "@/modules/alerts/domain/alert-status";
import type { VehicleTechnicalData } from "../domain/technical-data";
import { changeStatusAction } from "../application/vehicle-actions";
import type { VehicleActionContext, VehicleDetail } from "../application/vehicle-queries";
import {
  OilChangeForm,
  RenewDocumentForm,
  TechnicalDataForm,
  UpdateKmForm,
  UpdateTaxForm,
} from "./vehicle-action-forms";
import { EditVehicleForm } from "./vehicle-form";
import { AssignDriverForm, SellForm, TransferOwnerForm } from "./vehicle-people-forms";

export type ActionKey =
  | "edit"
  | "technical"
  | "document"
  | "tax"
  | "oil"
  | "km"
  | "driver"
  | "owner"
  | "sell";

const ACTIONS: Record<
  ActionKey,
  { label: string; title: string; icon: ComponentType<{ className?: string }> }
> = {
  edit: { label: "Editar datos", title: "Editar datos del vehículo", icon: Pencil },
  technical: { label: "Editar datos técnicos", title: "Editar datos técnicos", icon: Wrench },
  document: { label: "Renovar documento", title: "Renovar documento", icon: CalendarClock },
  tax: { label: "Impuesto", title: "Actualizar impuesto", icon: Receipt },
  oil: { label: "Cambio de aceite", title: "Registrar cambio de aceite", icon: Droplets },
  km: { label: "Kilometraje", title: "Actualizar kilometraje", icon: Gauge },
  driver: { label: "Asignar conductor", title: "Asignar conductor", icon: UserRound },
  owner: { label: "Traspasar", title: "Traspasar propietario", icon: ArrowRightLeft },
  sell: { label: "Vender", title: "Vender vehículo", icon: HandCoins },
};

type Notice = { tone: "ok" | "error"; text: string };

interface FileActionsContext {
  plate: string;
  status: VehicleStatus;
  /** No action control shows: the vehicle is sold or the user may only read. */
  locked: boolean;
  open: (key: ActionKey) => void;
  notify: (notice: Notice) => void;
}

const Ctx = createContext<FileActionsContext | null>(null);

export function useFileActions() {
  const value = useContext(Ctx);
  if (!value) throw new Error("File action controls must sit inside <FileActions>");
  return value;
}

/**
 * Owns the one side panel of the vehicle file. Buttons anywhere below
 * (`ActionButtons`, `SellButton`) open it through context, so the page itself
 * stays a server component.
 */
export function FileActions({
  plate,
  status,
  ctx,
  edit,
  technical,
  current,
  readOnly = false,
  children,
}: {
  plate: string;
  status: VehicleStatus;
  ctx: VehicleActionContext;
  edit: VehicleDetail["edit"];
  /** Current "Datos generales" prefilling the technical data form. */
  technical: VehicleTechnicalData;
  /** Who the sale would close, shown in the sell form. */
  current: { owner: string | null; driver: string | null };
  /** The user cannot change anything: every action control is hidden. */
  readOnly?: boolean;
  children: ReactNode;
}) {
  const [active, setActive] = useState<ActionKey | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);

  const close = () => setOpen(false);
  const notify = (notice: Notice) => {
    setMessage(notice);
    setTimeout(() => setMessage((m) => (m === notice ? null : m)), 6000);
  };
  const common = {
    plate,
    ctx,
    onCancel: close,
    onDone: (text: string) => {
      notify({ tone: "ok", text });
      close();
    },
  };

  return (
    <Ctx.Provider
      value={{
        plate,
        status,
        locked: readOnly || status === "SOLD",
        open: (key) => {
          setMessage(null);
          setActive(key);
          setOpen(true);
        },
        notify,
      }}
    >
      {children}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-soft",
            message.tone === "error"
              ? "border-destructive/20 bg-popover text-destructive"
              : "border-ok-foreground/20 bg-ok text-ok-foreground",
          )}
        >
          {message.tone === "error" ? (
            <AlertCircle className="size-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          )}
          {message.text}
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
            technical={technical}
            options={edit.options}
            onCancel={close}
            onDone={common.onDone}
          />
        )}
        {active === "technical" && <TechnicalDataForm {...common} values={technical} />}
        {active === "document" && <RenewDocumentForm {...common} />}
        {active === "tax" && <UpdateTaxForm {...common} />}
        {active === "oil" && <OilChangeForm {...common} />}
        {active === "km" && <UpdateKmForm {...common} />}
        {active === "driver" && <AssignDriverForm {...common} />}
        {active === "owner" && <TransferOwnerForm {...common} />}
        {active === "sell" && <SellForm {...common} current={current} />}
      </SlideOver>
    </Ctx.Provider>
  );
}

/**
 * Compact action buttons for one section (32px on desktop, 44px on phones). `primary` names the
 * one key drawn filled; the rest are outlined. Hidden once the vehicle is sold.
 */
export function ActionButtons({ keys, primary }: { keys: readonly ActionKey[]; primary?: ActionKey }) {
  const { locked, open } = useFileActions();
  if (locked) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map((key) => {
        const { label, icon: Icon } = ACTIONS[key];
        return (
          <Button
            key={key}
            type="button"
            variant={key === primary ? "default" : "outline"}
            className={
              key === primary
                ? "h-11 bg-foreground px-3 text-background hover:bg-foreground/85 md:h-8"
                : "h-11 bg-transparent px-3 hover:bg-muted md:h-8"
            }
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

const STATUS_CHOICES: Array<{ value: Exclude<VehicleStatus, "SOLD">; label: string; dot: string }> = [
  { value: "ACTIVE", label: "Activo", dot: "bg-ok-foreground cursor-pointer" },
  { value: "IDLE", label: "Quieta", dot: "bg-muted-foreground cursor-pointer" },
  { value: "IN_WORKSHOP", label: "Taller", dot: "bg-warn-foreground cursor-pointer" },
];

/**
 * Operational status as a segmented control: one tap saves it, no panel. The pick shows at
 * once (optimistic) and falls back if the server refuses. Hidden once the vehicle is sold.
 */
export function StatusSwitch() {
  const { plate, status, locked, notify } = useFileActions();
  const [shown, setShown] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  if (locked) return null;

  function choose(next: (typeof STATUS_CHOICES)[number]) {
    if (next.value === shown || pending) return;
    startTransition(async () => {
      setShown(next.value);
      const fd = new FormData();
      fd.set("status", next.value);
      const result = await changeStatusAction(plate, fd);
      notify(result.ok ? { tone: "ok", text: `Estado: ${next.label}.` } : { tone: "error", text: result.error });
    });
  }

  return (
    <div
      role="group"
      aria-label="Estado del vehículo"
      aria-busy={pending}
      className="inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5"
    >
      {STATUS_CHOICES.map((choice) => {
        const on = choice.value === shown;
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={on}
            onClick={() => choose(choice)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm outline-none transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 md:h-7 md:px-2.5",
              on
                ? "bg-background font-medium text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full transition-opacity duration-150",
                choice.dot,
                on ? "opacity-100" : "opacity-40",
              )}
            />
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

export function SoldNotice() {
  return (
    <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
      Vehículo vendido: ya no admite cambios.
    </p>
  );
}

/** Header button for editing the vehicle's own data; hidden once sold. */
export function EditDataButton() {
  const { locked, open } = useFileActions();
  if (locked) return null;
  const { label, icon: Icon } = ACTIONS.edit;
  return (
    <Button type="button" variant="outline" className="h-11 bg-transparent px-3 hover:bg-muted md:h-8" onClick={() => open("edit")}>
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

/** Small text button that opens one action beside the value it changes; hidden once sold. */
export function InlineAction({
  action,
  boxed = false,
  label,
  children,
}: {
  action: ActionKey;
  /** A small outlined button instead of underlined text. */
  boxed?: boolean;
  /** Accessible name and tooltip, for an icon-only button. */
  label?: string;
  children: ReactNode;
}) {
  const { locked, open } = useFileActions();
  if (locked) return null;
  return (
    <button
      type="button"
      onClick={() => open(action)}
      aria-label={label}
      title={label}
      className={
        boxed
          ? `inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-md border text-xs font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 md:h-8 ${label ? "w-11 md:w-8" : "px-2.5"}`
          : "inline-flex min-h-11 cursor-pointer items-center rounded-md px-1.5 text-sm text-muted-foreground underline decoration-muted-foreground/60 decoration-1 underline-offset-4 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 md:min-h-7"
      }
    >
      {children}
    </button>
  );
}

/** Header button that opens the sale form; icon only, kept apart from daily actions. Hidden once sold. */
export function SellButton() {
  const { locked, open } = useFileActions();
  if (locked) return null;
  return (
    <button
      type="button"
      aria-label="Vender vehículo"
      title="Vender vehículo"
      onClick={() => open("sell")}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-transparent text-muted-foreground outline-none transition-colors duration-150 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 md:size-8"
    >
      <HandCoins className="size-4" aria-hidden />
    </button>
  );
}
