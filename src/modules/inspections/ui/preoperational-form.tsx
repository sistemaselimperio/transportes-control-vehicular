"use client";

import { CircleCheck, OctagonX, Star } from "lucide-react";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitInspectionAction, type SubmitInspectionResult } from "../application/inspection-actions";
import {
  FORM_CODE,
  FORM_VERSION,
  PREOPERATIONAL_CHECKLIST,
  itemNumber,
  sectionNumber,
  type ChecklistItem,
} from "../domain/preoperational-checklist";
import {
  applicableItems,
  bogotaDateTime,
  MAX_NOTE_LENGTH,
  validateInspection,
  type AnswerStatus,
  type InspectionErrors,
} from "../domain/preoperational-inspection";
import { SignaturePad } from "./signature-pad";

type Header = {
  date: string;
  time: string;
  plate: string;
  trailerPlate: string;
  driverName: string;
  driverId: string;
  odometer: string;
  route: string;
};

type Draft = { status?: AnswerStatus; note: string };

type HeaderEdits = Omit<Header, "date" | "time"> & { date: string | null; time: string | null };

const EMPTY_EDITS: HeaderEdits = {
  date: null,
  time: null,
  plate: "",
  trailerPlate: "",
  driverName: "",
  driverId: "",
  odometer: "",
  route: "",
};

const HEADER_ORDER = ["date", "time", "plate", "trailerPlate", "driverName", "driverId", "odometer", "route"] as const;

const INPUT = "h-12 text-base";

const PLATE_SUGGESTIONS_ID = "fleet-plates";

type Done = Extract<SubmitInspectionResult, { ok: true }>;

const subscribeNever = () => () => {};
const clockKey = () => {
  const { date, time } = bogotaDateTime(new Date());
  return `${date}T${time}`;
};

/**
 * Colombia date and time for the form defaults. The server render and hydration see empty values
 * (the browser's clock is not known there); the client snapshot takes over right after.
 */
function useColombiaNow(): { date: string; time: string } {
  const key = useSyncExternalStore(subscribeNever, clockKey, () => "");
  const [date = "", time = ""] = key.split("T");
  return { date, time };
}

/** The public page: the form, then a green or red result screen, then back to a blank form. */
export function PreoperationalFlow({ plates }: { plates: readonly string[] }) {
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<Done | null>(null);

  if (done) {
    return (
      <ResultScreen
        done={done}
        onAnother={() => {
          setDone(null);
          setRound((r) => r + 1);
        }}
      />
    );
  }
  return <InspectionForm key={round} plates={plates} onDone={setDone} />;
}

function InspectionForm({ plates, onDone }: { plates: readonly string[]; onDone: (result: Done) => void }) {
  // What the user typed; date and time stay null until edited and then follow the clock.
  const [edits, setHeader] = useState<HeaderEdits>(EMPTY_EDITS);
  const defaults = useColombiaNow();
  const [muleNotApplicable, setMuleNotApplicable] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Draft>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<InspectionErrors>({});
  const [pending, startTransition] = useTransition();

  const header = { ...edits, date: edits.date ?? defaults.date, time: edits.time ?? defaults.time };

  const items = applicableItems(muleNotApplicable);
  const answered = items.filter((item) => answers[item.id]?.status).length;

  const clearError = (key: string) =>
    setErrors((current) => {
      if (!(key in current)) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });

  const setField = (key: keyof Header, value: string) => {
    setHeader((h) => ({ ...h, [key]: value }));
    clearError(key);
  };

  const setStatus = (item: ChecklistItem, status: AnswerStatus) => {
    setAnswers((a) => ({ ...a, [item.id]: { note: a[item.id]?.note ?? "", status } }));
    clearError(item.id);
  };

  const setNote = (item: ChecklistItem, note: string) => {
    setAnswers((a) => ({ ...a, [item.id]: { ...a[item.id], note } }));
    clearError(item.id);
  };

  const showErrors = (found: InspectionErrors) => {
    setErrors(found);
    const order = [...HEADER_ORDER, ...items.map((i) => i.id), "signature"];
    const first = order.find((key) => key in found);
    const target = first && document.getElementById(fieldId(first));
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    }
  };

  const submit = () => {
    const payload = { ...header, muleNotApplicable, answers, signature: signature ?? "", website };
    const check = validateInspection(payload);
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await submitInspectionAction(payload);
        if (result.ok) onDone(result);
        else showErrors(result.errors);
      } catch {
        setErrors({ form: "No se pudo enviar. Revisa tu conexión e intenta de nuevo." });
      }
    });
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-12">
      <header className="flex items-center gap-3">
        <BrandMark decorative className="h-14 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl leading-tight font-bold tracking-tight">Inspección preoperacional diaria</h1>
          <p className="micro-label mt-1.5">
            Código {FORM_CODE} · Versión {FORM_VERSION}
          </p>
        </div>
      </header>

      <p className="mt-5 rounded-xl border-2 border-foreground/70 bg-warn/50 p-4 text-base leading-snug">
        Marque <strong>BIEN</strong> o <strong>MAL</strong>. No deje casillas vacías. Si un <strong>PUNTO CRÍTICO (★)</strong>{" "}
        está en MAL, el vehículo <strong>NO SALE</strong>: avise al despachador y a la Jefe de Mantenimiento.
      </p>

      <form
        noValidate
        className="mt-6 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section aria-labelledby="datos-heading" className="space-y-4">
          <h2 id="datos-heading" className="text-lg font-bold">
            Datos de la inspección
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Fecha" name="date" type="date" value={header.date} error={errors.date} onChange={setField} />
            <TextField label="Hora" name="time" type="time" value={header.time} error={errors.time} onChange={setField} />
          </div>
          {/* Only the fleet's plates, as suggestions: the fields stay free text. */}
          <datalist id={PLATE_SUGGESTIONS_ID}>
            {plates.map((plate) => (
              <option key={plate} value={plate} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Placa"
              name="plate"
              value={header.plate}
              error={errors.plate}
              onChange={setField}
              required
              autoCapitalize="characters"
              autoComplete="off"
              list={PLATE_SUGGESTIONS_ID}
              className="uppercase"
            />
            <TextField
              label="Placa remolque"
              name="trailerPlate"
              value={header.trailerPlate}
              error={errors.trailerPlate}
              onChange={setField}
              hint="Opcional"
              autoCapitalize="characters"
              autoComplete="off"
              list={PLATE_SUGGESTIONS_ID}
              className="uppercase"
            />
          </div>
          <TextField
            label="Conductor"
            name="driverName"
            value={header.driverName}
            error={errors.driverName}
            onChange={setField}
            required
            autoComplete="name"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Cédula"
              name="driverId"
              value={header.driverId}
              error={errors.driverId}
              onChange={setField}
              required
              inputMode="numeric"
              autoComplete="off"
            />
            <TextField
              label="Kilometraje"
              name="odometer"
              value={header.odometer}
              error={errors.odometer}
              onChange={setField}
              required
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <TextField
            label="Ruta / destino"
            name="route"
            value={header.route}
            error={errors.route}
            onChange={setField}
            required
            autoComplete="off"
          />
        </section>

        {PREOPERATIONAL_CHECKLIST.map((section, sectionIndex) => {
          const hidden = section.muleOnly && muleNotApplicable;
          return (
            <section key={section.id} aria-labelledby={`section-${section.id}`} className="space-y-3">
              <div>
                <h2 id={`section-${section.id}`} className="text-lg font-bold">
                  {sectionNumber(sectionIndex)}. {section.title}
                </h2>
                {section.hint && <p className="text-sm text-muted-foreground">{section.hint}</p>}
              </div>

              {section.muleOnly && (
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 bg-card px-3 py-2 text-base font-medium">
                  <input
                    type="checkbox"
                    className="size-6 shrink-0"
                    checked={muleNotApplicable}
                    onChange={(e) => setMuleNotApplicable(e.target.checked)}
                  />
                  No aplica (el vehículo no es mula)
                </label>
              )}

              {hidden ? (
                <p className="text-sm text-muted-foreground">Esta sección no aplica y no es obligatoria.</p>
              ) : (
                section.items.map((item, itemIndex) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    number={itemNumber(sectionIndex, itemIndex)}
                    draft={answers[item.id]}
                    error={errors[item.id]}
                    onStatus={setStatus}
                    onNote={setNote}
                  />
                ))
              )}
            </section>
          );
        })}

        <section aria-labelledby="firma-heading" className="space-y-3">
          <h2 id="firma-heading" className="text-lg font-bold">
            Firma del conductor
          </h2>
          <SignaturePad
            id={fieldId("signature")}
            invalid={Boolean(errors.signature)}
            onChange={(value) => {
              setSignature(value);
              if (value) clearError("signature");
            }}
          />
          {errors.signature && <ErrorText>{errors.signature}</ErrorText>}
        </section>

        {/* Honeypot: invisible to people, tempting to bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Sitio web
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {answered} de {items.length} puntos marcados
          </p>
          {hasErrors && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-base font-medium text-destructive">
              {errors.form ?? "Faltan datos. Revisa los campos marcados en rojo."}
            </p>
          )}
          <Button type="submit" className="h-14 w-full text-lg" disabled={pending} aria-busy={pending}>
            {pending ? "Enviando…" : "Enviar inspección"}
          </Button>
        </div>
      </form>
    </main>
  );
}

const fieldId = (key: string) => (key.includes(".") ? `item-${key}` : `field-${key}`);

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

function TextField({
  label,
  name,
  value,
  error,
  onChange,
  required,
  hint,
  className,
  ...rest
}: {
  label: string;
  name: keyof Header;
  value: string;
  error?: string;
  onChange: (name: keyof Header, value: string) => void;
  required?: boolean;
  hint?: string;
} & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange">) {
  const id = fieldId(name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="gap-1 text-base text-foreground">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(INPUT, className)}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  number,
  draft,
  error,
  onStatus,
  onNote,
}: {
  item: ChecklistItem;
  number: string;
  draft?: Draft;
  error?: string;
  onStatus: (item: ChecklistItem, status: AnswerStatus) => void;
  onNote: (item: ChecklistItem, note: string) => void;
}) {
  const labelId = `label-${item.id}`;
  const failed = draft?.status === "MAL";
  return (
    <div
      id={fieldId(item.id)}
      tabIndex={-1}
      className={cn(
        "space-y-3 rounded-xl border-2 bg-card p-3 outline-none",
        error ? "border-destructive" : failed ? "border-danger-foreground/60" : "border-border",
      )}
    >
      <p id={labelId} className="text-base leading-snug font-medium">
        <span className="num text-muted-foreground">{number}</span> {item.label}
        {item.critical && (
          <span className="ml-2 inline-flex items-center gap-0.5 rounded-md bg-warn px-1.5 py-0.5 align-middle text-xs font-bold text-warn-foreground">
            <Star className="size-3 fill-current" aria-hidden />
            Crítico
          </span>
        )}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-2">
        <Choice item={item} value="BIEN" checked={draft?.status === "BIEN"} onSelect={onStatus} />
        <Choice item={item} value="MAL" checked={failed} onSelect={onStatus} />
      </div>
      {failed && (
        <div className="space-y-1.5">
          <Label htmlFor={`note-${item.id}`} className="text-base text-foreground">
            Qué encontré
          </Label>
          <Textarea
            id={`note-${item.id}`}
            value={draft?.note ?? ""}
            onChange={(e) => onNote(item, e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={2}
            aria-invalid={error ? true : undefined}
            className="min-h-20 text-base"
          />
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function Choice({
  item,
  value,
  checked,
  onSelect,
}: {
  item: ChecklistItem;
  value: AnswerStatus;
  checked: boolean;
  onSelect: (item: ChecklistItem, status: AnswerStatus) => void;
}) {
  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name={`answer-${item.id}`}
        value={value}
        checked={checked}
        onChange={() => onSelect(item, value)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex h-14 items-center justify-center rounded-lg border-2 border-input bg-background text-lg font-bold tracking-wide select-none",
          "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/70",
          value === "BIEN"
            ? "peer-checked:border-ok-foreground peer-checked:bg-ok peer-checked:text-ok-foreground"
            : "peer-checked:border-danger-foreground peer-checked:bg-danger-foreground peer-checked:text-white",
        )}
      >
        {value}
      </span>
    </label>
  );
}

function ResultScreen({ done, onAnother }: { done: Done; onAnother: () => void }) {
  const blocked = done.failedCritical.length > 0;
  return (
    <main
      className={cn(
        "flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 px-5 py-10 text-center",
        blocked ? "bg-danger-foreground text-white" : "bg-ok text-ok-foreground",
      )}
    >
      {blocked ? <OctagonX className="size-20" aria-hidden /> : <CircleCheck className="size-20" aria-hidden />}
      <div role="status" className="max-w-md space-y-3">
        <h1 className="text-4xl leading-tight font-black tracking-tight uppercase">
          {blocked ? "El vehículo no sale" : "Inspección enviada"}
        </h1>
        <p className="text-xl font-semibold">
          {blocked ? "Avise al despachador y a la Jefe de Mantenimiento." : "Todos los puntos críticos están en BIEN. Buen viaje."}
        </p>
      </div>
      {blocked && (
        <div className="w-full max-w-md rounded-xl bg-white/15 p-4 text-left">
          <p className="mb-2 text-sm font-bold tracking-wide uppercase">Puntos críticos en MAL</p>
          <ul className="list-disc space-y-1 pl-5 text-lg font-medium">
            {done.failedCritical.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      )}
      <Button
        type="button"
        onClick={onAnother}
        className={cn(
          "h-14 w-full max-w-md text-lg",
          blocked
            ? "bg-white text-danger-foreground hover:bg-white/90"
            : "bg-ok-foreground text-white hover:bg-ok-foreground/90",
        )}
      >
        Enviar otra inspección
      </Button>
    </main>
  );
}
