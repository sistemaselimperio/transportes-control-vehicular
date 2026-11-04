"use client";

import { ArrowLeft, Ban, CircleCheck, ClipboardCheck, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { decideExitAction, recordClosureAction, type ExitActionResult } from "../application/exit-actions";
import {
  MAX_CLOSURE_ACTION_LENGTH,
  MAX_CLOSURE_RESPONSIBLE_LENGTH,
  MAX_CLOSURE_WORK_ORDER_LENGTH,
  type ExitDecision,
  type ExitErrors,
} from "../domain/exit-decision";
import { bogotaDateTime } from "../domain/preoperational-inspection";
import { ExitBadge } from "./inspection-badges";
import { formatInspectionDate } from "./inspection-format";

/** The saved decision / closure as the panel shows it. Names and dates are already formatted. */
export type ExitPanelProps = {
  inspectionId: string;
  inspectionDate: string;
  hasCriticalFailure: boolean;
  hasFailedItems: boolean;
  decision: { value: ExitDecision; authorizedTime: string | null; signoff: string } | null;
  closure: { date: string; workOrder: string; action: string; responsible: string; signoff: string } | null;
  /** Colombia date and time at render; the form defaults. */
  defaults: { date: string; time: string };
};

type SavedDecision = NonNullable<ExitPanelProps["decision"]>;
type SavedClosure = NonNullable<ExitPanelProps["closure"]>;

const CARD = "space-y-3 rounded-2xl border bg-card p-4 sm:p-5";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Runs a save action in a transition; refreshes the page data on success. */
function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<ExitErrors>({});

  function run(action: () => Promise<ExitActionResult>, onDone?: () => void) {
    setErrors({});
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone?.();
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return { pending, errors, run };
}

/** One saved value of a card: small label over the value, laid out two per row. */
function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function DecisionDetails({ decision }: { decision: SavedDecision | null }) {
  if (!decision) return <p className="text-sm text-muted-foreground">Pendiente: la Jefe de Mantenimiento aún no decide.</p>;
  const apto = decision.value === "APTO";
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      <Field label="Decisión">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          {apto ? (
            <CircleCheck className="size-4 text-ok-foreground" aria-hidden />
          ) : (
            <Ban className="size-4 text-danger-foreground" aria-hidden />
          )}
          {apto ? "Apto para salir" : "No apto"}
        </span>
      </Field>
      <Field label="Hora de salida autorizada">
        <span className="num">{apto && decision.authorizedTime ? decision.authorizedTime : "—"}</span>
      </Field>
      <Field label="Autorizado por" wide>
        {decision.signoff}
      </Field>
    </dl>
  );
}

/** A recorded closure, read-only: once saved it is final for everyone, admin included. */
function ClosureDetails({ closure }: { closure: SavedClosure }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      <Field label="Fecha de cierre">
        <span className="num">{formatInspectionDate(closure.date)}</span>
      </Field>
      <Field label="Orden de trabajo">{closure.workOrder || "—"}</Field>
      <Field label="Qué se hizo" wide>
        {closure.action}
      </Field>
      <Field label="Responsable">{closure.responsible || "—"}</Field>
      <Field label="Registrado por">{closure.signoff}</Field>
    </dl>
  );
}

function DecisionCard({ decision, action }: { decision: SavedDecision | null; action?: ReactNode }) {
  return (
    <section aria-labelledby="exit-title" className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="exit-title" className="text-lg font-semibold">
          Decisión de salida
        </h2>
        {action}
      </div>
      <DecisionDetails decision={decision} />
    </section>
  );
}

function ClosureCard({ closure, action }: { closure: SavedClosure | null; action?: ReactNode }) {
  return (
    <section aria-labelledby="closure-title" className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="closure-title" className="text-lg font-semibold">
          Cierre de la novedad
        </h2>
        {action}
      </div>
      {closure ? (
        <>
          <ClosureDetails closure={closure} />
          <p className="text-xs text-muted-foreground">El cierre ya fue registrado y no se puede modificar.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Sin cierre registrado.</p>
      )}
    </section>
  );
}

/** The decision form, inside the slide-over: time, then APTO / NO APTO (with a confirmation for APTO on a critical MAL). */
function DecisionForm({
  inspectionId,
  hasCriticalFailure,
  decision,
  onDone,
}: Pick<ExitPanelProps, "inspectionId" | "hasCriticalFailure" | "decision"> & { onDone: () => void }) {
  const { pending, errors, run } = useSave();
  // A first decision suggests the current time; a change keeps the saved one.
  const [time, setTime] = useState(() => decision?.authorizedTime ?? bogotaDateTime(new Date()).time);
  // The critical-failure confirmation step: set when APTO was chosen on a vehicle with a critical MAL.
  const [confirming, setConfirming] = useState(false);

  function save(value: ExitDecision) {
    run(() => decideExitAction(inspectionId, { decision: value, authorizedTime: value === "APTO" ? time : null }), onDone);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="exit-time" className="text-sm text-foreground">
          Hora de salida autorizada
        </Label>
        <Input
          id="exit-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-invalid={Boolean(errors.authorizedTime)}
          aria-describedby={errors.authorizedTime ? "exit-time-error" : undefined}
          className="h-11 md:h-9"
        />
        <FieldError id="exit-time-error" message={errors.authorizedTime} />
      </div>

      {confirming ? (
        <div role="alert" className="space-y-3 rounded-xl border-2 border-destructive p-3">
          <p className="font-semibold">Hay puntos críticos en MAL. ¿Autorizar la salida de todas formas?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11 px-4 md:h-10" disabled={pending} onClick={() => save("APTO")}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Sí, autorizar la salida
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4 md:h-10"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => (hasCriticalFailure ? setConfirming(true) : save("APTO"))}
            className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-ok-foreground/40 bg-ok px-3 py-3 text-base font-bold text-ok-foreground uppercase outline-none hover:border-ok-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:opacity-50"
          >
            <CircleCheck className="size-5 shrink-0" aria-hidden />
            Apto para salir
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save("NO_APTO")}
            className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-danger-foreground/40 bg-danger px-3 py-3 text-base font-bold text-danger-foreground uppercase outline-none hover:border-danger-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:opacity-50"
          >
            <Ban className="size-5 shrink-0" aria-hidden />
            No apto
          </button>
        </div>
      )}

      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Guardando…
        </p>
      )}
      <FieldError id="exit-decision-error" message={errors.decision ?? errors.form} />
    </div>
  );
}

/** The closure form, inside the slide-over. Saving is final, so the first submit only asks to confirm. */
function ClosureForm({
  inspectionId,
  inspectionDate,
  defaults,
  onDone,
}: Pick<ExitPanelProps, "inspectionId" | "inspectionDate" | "defaults"> & { onDone: () => void }) {
  const { pending, errors, run } = useSave();
  const [confirming, setConfirming] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    const fd = new FormData(event.currentTarget);
    run(
      () =>
        recordClosureAction(inspectionId, {
          date: fd.get("date"),
          workOrder: fd.get("workOrder"),
          action: fd.get("action"),
          responsible: fd.get("responsible"),
        }),
      onDone,
    );
  }

  const fieldProps = (name: string) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `closure-${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} onChange={() => setConfirming(false)} className="grid grid-cols-2 gap-4" noValidate>
      <p className="col-span-2 text-sm text-muted-foreground">Una vez guardado, el cierre no se puede modificar.</p>
      <div className="space-y-1.5">
        <Label htmlFor="closure-date" className="text-sm text-foreground">
          Fecha de cierre
        </Label>
        <Input
          id="closure-date"
          name="date"
          type="date"
          min={inspectionDate}
          defaultValue={defaults.date}
          className="h-11 md:h-9"
          {...fieldProps("date")}
        />
        <FieldError id="closure-date-error" message={errors.date} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="closure-work-order" className="text-sm text-foreground">
          Orden de trabajo N.º <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="closure-work-order"
          name="workOrder"
          maxLength={MAX_CLOSURE_WORK_ORDER_LENGTH}
          autoComplete="off"
          className="h-11 md:h-9"
          {...fieldProps("workOrder")}
        />
        <FieldError id="closure-workOrder-error" message={errors.workOrder} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="closure-action" className="text-sm text-foreground">
          Qué se hizo
        </Label>
        <Textarea
          id="closure-action"
          name="action"
          rows={3}
          maxLength={MAX_CLOSURE_ACTION_LENGTH}
          {...fieldProps("action")}
        />
        <FieldError id="closure-action-error" message={errors.action} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="closure-responsible" className="text-sm text-foreground">
          Responsable <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="closure-responsible"
          name="responsible"
          maxLength={MAX_CLOSURE_RESPONSIBLE_LENGTH}
          autoComplete="off"
          className="h-11 md:h-9"
          {...fieldProps("responsible")}
        />
        <FieldError id="closure-responsible-error" message={errors.responsible} />
      </div>

      {confirming && (
        <p role="alert" className="col-span-2 rounded-lg bg-warn/60 p-3 text-sm font-medium">
          Revise los datos: después de confirmar, el cierre no se puede modificar.
        </p>
      )}
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 px-4 md:h-10" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {confirming ? "Confirmar cierre" : "Guardar cierre"}
        </Button>
        {confirming && (
          <Button type="button" variant="ghost" className="h-11 px-4 md:h-10" onClick={() => setConfirming(false)}>
            Volver a revisar
          </Button>
        )}
        <FieldError id="closure-form-error" message={errors.form} />
      </div>
    </form>
  );
}

type View = "overview" | "decision" | "closure";

const VIEW_TITLES: Record<View, string> = {
  overview: "Decisión de salida y cierre",
  decision: "Decisión de salida",
  closure: "Cierre de la novedad",
};

/**
 * The decision and the closure live in a centered modal so the sheet keeps the page: a compact bar
 * shows the status and opens it. Inside, the two cards sit side by side; registering swaps the
 * modal to that form (with a way back) instead of stacking another dialog. Staff get the same
 * modal without actions. Screen only.
 */
function ExitModal({ canDecide, ...props }: ExitPanelProps & { canDecide: boolean }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("overview");
  const { decision, closure, hasFailedItems } = props;

  const openModal = () => {
    setView("overview");
    setOpen(true);
  };
  const back = () => setView("overview");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">Salida</span>
            <ExitBadge status={decision ? decision.value : "PENDING"} />
          </span>
          {hasFailedItems && (
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Cierre</span>
              <span className="font-medium">{closure ? "Registrado" : "Pendiente"}</span>
            </span>
          )}
        </div>
        <Button type="button" variant="outline" className="h-11 px-4 md:h-9" onClick={openModal}>
          <ClipboardCheck aria-hidden />
          Decisión y cierre
        </Button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/35 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
          <Dialog.Popup
            className={cn(
              "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border bg-popover text-popover-foreground shadow-soft outline-none transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
              view === "overview" && hasFailedItems ? "max-w-4xl" : "max-w-lg",
            )}
          >
            <header className="flex items-center gap-2 border-b px-5 py-3">
              {view !== "overview" && (
                <button
                  type="button"
                  onClick={back}
                  aria-label="Volver"
                  className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ArrowLeft className="size-5" aria-hidden />
                </button>
              )}
              <Dialog.Title className="min-w-0 flex-1 text-base font-semibold tracking-tight">{VIEW_TITLES[view]}</Dialog.Title>
              <Dialog.Close
                aria-label="Cerrar"
                className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {view === "overview" && (
                <div className={cn("grid gap-4", hasFailedItems && "md:grid-cols-2")}>
                  <DecisionCard
                    decision={decision}
                    action={
                      canDecide && (
                        <Button type="button" variant="outline" className="h-11 px-4 md:h-9" onClick={() => setView("decision")}>
                          {decision ? "Cambiar" : "Registrar"}
                        </Button>
                      )
                    }
                  />
                  {hasFailedItems && (
                    <ClosureCard
                      closure={closure}
                      action={
                        canDecide &&
                        !closure && (
                          <Button type="button" variant="outline" className="h-11 px-4 md:h-9" onClick={() => setView("closure")}>
                            Registrar
                          </Button>
                        )
                      }
                    />
                  )}
                </div>
              )}
              {view === "decision" && <DecisionForm {...props} onDone={back} />}
              {view === "closure" && <ClosureForm {...props} onDone={back} />}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** Inspections managers only: records the exit decision and, when something is MAL, the novelty closure. */
export function ExitPanel(props: ExitPanelProps) {
  return <ExitModal {...props} canDecide />;
}

/** Read-only view of the decision and the closure, for roles that only read inspections. */
export function ExitSummary(props: ExitPanelProps) {
  return <ExitModal {...props} canDecide={false} />;
}
