"use client";

import { Ban, CircleCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
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

const PANEL = "space-y-4 rounded-2xl border bg-card p-4 print:hidden sm:p-5";

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
  const [saved, setSaved] = useState(false);

  function run(action: () => Promise<ExitActionResult>, onDone?: () => void) {
    setErrors({});
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setSaved(true);
        onDone?.();
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return { pending, errors, saved, run };
}

function DecisionPanel({
  inspectionId,
  hasCriticalFailure,
  decision,
  defaults,
}: Pick<ExitPanelProps, "inspectionId" | "hasCriticalFailure" | "decision" | "defaults">) {
  const { pending, errors, saved, run } = useSave();
  const [changing, setChanging] = useState(false);
  const [time, setTime] = useState(decision?.authorizedTime ?? defaults.time);
  // The critical-failure confirmation step: set when APTO was chosen on a vehicle with a critical MAL.
  const [confirming, setConfirming] = useState(false);

  const showButtons = !decision || changing;

  function save(value: ExitDecision) {
    run(
      () => decideExitAction(inspectionId, { decision: value, authorizedTime: value === "APTO" ? time : null }),
      () => {
        setChanging(false);
        setConfirming(false);
      },
    );
  }

  function chooseApto() {
    // Refresh the suggested time unless the user already chose one for this decision.
    if (!decision || !changing) setTime(bogotaDateTime(new Date()).time);
    if (hasCriticalFailure) setConfirming(true);
    else save("APTO");
  }

  return (
    <section aria-labelledby="exit-title" className={PANEL}>
      <h2 id="exit-title" className="text-lg font-semibold">
        Decisión de salida
      </h2>

      {decision && (
        <div className="space-y-1" aria-live="polite">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {decision.value === "APTO" ? (
              <CircleCheck className="size-5 text-ok-foreground" aria-hidden />
            ) : (
              <Ban className="size-5 text-danger-foreground" aria-hidden />
            )}
            {decision.value === "APTO" ? "Apto para salir" : "No apto"}
            {decision.value === "APTO" && decision.authorizedTime && (
              <span className="num font-normal text-muted-foreground">· salida autorizada {decision.authorizedTime}</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">Autorizado por {decision.signoff}</p>
          {!showButtons && (
            <Button type="button" variant="outline" className="mt-2 h-11 px-4 md:h-9" onClick={() => setChanging(true)}>
              Cambiar decisión
            </Button>
          )}
        </div>
      )}

      {showButtons && (
        <div className="space-y-4">
          <div className="max-w-xs space-y-1.5">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={pending}
                onClick={chooseApto}
                className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-ok-foreground/40 bg-ok px-4 py-3 text-lg font-bold text-ok-foreground uppercase outline-none hover:border-ok-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:opacity-50"
              >
                <CircleCheck className="size-6" aria-hidden />
                Apto para salir
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => save("NO_APTO")}
                className="flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-danger-foreground/40 bg-danger px-4 py-3 text-lg font-bold text-danger-foreground uppercase outline-none hover:border-danger-foreground focus-visible:ring-3 focus-visible:ring-ring/70 disabled:opacity-50"
              >
                <Ban className="size-6" aria-hidden />
                No apto
              </button>
            </div>
          )}

          {changing && !confirming && (
            <Button type="button" variant="ghost" className="h-11 px-4 md:h-9" disabled={pending} onClick={() => setChanging(false)}>
              Cancelar cambio
            </Button>
          )}
        </div>
      )}

      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Guardando…
        </p>
      )}
      <FieldError id="exit-decision-error" message={errors.decision ?? errors.form} />
      {saved && !pending && !errors.form && (
        <p role="status" className="text-sm text-ok-foreground">
          Decisión guardada.
        </p>
      )}
    </section>
  );
}

function ClosurePanel({
  inspectionId,
  inspectionDate,
  closure,
  defaults,
}: Pick<ExitPanelProps, "inspectionId" | "inspectionDate" | "closure" | "defaults">) {
  const { pending, errors, saved, run } = useSave();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    run(() =>
      recordClosureAction(inspectionId, {
        date: fd.get("date"),
        workOrder: fd.get("workOrder"),
        action: fd.get("action"),
        responsible: fd.get("responsible"),
      }),
    );
  }

  const fieldProps = (name: string) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `closure-${name}-error` : undefined,
  });

  return (
    <section aria-labelledby="closure-title" className={PANEL}>
      <div className="space-y-1">
        <h2 id="closure-title" className="text-lg font-semibold">
          Cierre de la novedad
        </h2>
        {closure && <p className="text-sm text-muted-foreground">Registrado por {closure.signoff}</p>}
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="closure-date" className="text-sm text-foreground">
            Fecha de cierre
          </Label>
          <Input
            id="closure-date"
            name="date"
            type="date"
            min={inspectionDate}
            defaultValue={closure?.date ?? defaults.date}
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
            defaultValue={closure?.workOrder ?? ""}
            maxLength={MAX_CLOSURE_WORK_ORDER_LENGTH}
            autoComplete="off"
            className="h-11 md:h-9"
            {...fieldProps("workOrder")}
          />
          <FieldError id="closure-workOrder-error" message={errors.workOrder} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="closure-action" className="text-sm text-foreground">
            Qué se hizo
          </Label>
          <Textarea
            id="closure-action"
            name="action"
            rows={3}
            defaultValue={closure?.action ?? ""}
            maxLength={MAX_CLOSURE_ACTION_LENGTH}
            {...fieldProps("action")}
          />
          <FieldError id="closure-action-error" message={errors.action} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="closure-responsible" className="text-sm text-foreground">
            Responsable <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="closure-responsible"
            name="responsible"
            defaultValue={closure?.responsible ?? ""}
            maxLength={MAX_CLOSURE_RESPONSIBLE_LENGTH}
            autoComplete="off"
            className="h-11 md:h-9"
            {...fieldProps("responsible")}
          />
          <FieldError id="closure-responsible-error" message={errors.responsible} />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" className="h-11 px-4 md:h-10" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {closure ? "Guardar cambios" : "Guardar cierre"}
          </Button>
          <FieldError id="closure-form-error" message={errors.form} />
          {saved && !pending && !errors.form && (
            <p role="status" className="text-sm text-ok-foreground">
              Cierre guardado.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

/** Admin only: the exit decision and, when something is MAL, the novelty closure. Screen only. */
export function ExitPanel(props: ExitPanelProps) {
  return (
    <div className={cn("space-y-4")}>
      <DecisionPanel {...props} />
      {props.hasFailedItems && <ClosurePanel {...props} />}
    </div>
  );
}

/** Read-only summary of the decision and the closure, for staff. Screen only. */
export function ExitSummary({
  decision,
  closure,
  hasFailedItems,
}: Pick<ExitPanelProps, "decision" | "closure" | "hasFailedItems">) {
  return (
    <section aria-label="Decisión de salida y cierre" className={cn(PANEL, "space-y-3")}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Decisión de salida</h2>
        {decision ? (
          <>
            <p className="font-semibold">
              {decision.value === "APTO" ? "Apto para salir" : "No apto"}
              {decision.value === "APTO" && decision.authorizedTime && (
                <span className="num font-normal text-muted-foreground"> · salida autorizada {decision.authorizedTime}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Autorizado por {decision.signoff}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Pendiente: la Jefe de Mantenimiento aún no decide.</p>
        )}
      </div>
      {hasFailedItems && (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Cierre de la novedad</h2>
          {closure ? (
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Fecha de cierre</dt>
              <dd className="num">{formatInspectionDate(closure.date)}</dd>
              {closure.workOrder && (
                <>
                  <dt className="text-muted-foreground">Orden de trabajo</dt>
                  <dd>{closure.workOrder}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Qué se hizo</dt>
              <dd>{closure.action}</dd>
              {closure.responsible && (
                <>
                  <dt className="text-muted-foreground">Responsable</dt>
                  <dd>{closure.responsible}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Registrado por</dt>
              <dd>{closure.signoff}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Sin cierre registrado.</p>
          )}
        </div>
      )}
    </section>
  );
}
