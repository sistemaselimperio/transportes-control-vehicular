"use client";

import { CircleCheck, OctagonX } from "lucide-react";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitInspectionAction, type SubmitInspectionResult } from "../application/inspection-actions";
import {
  PREOPERATIONAL_CHECKLIST,
  itemNumber,
  type ChecklistItem,
  type ChecklistSection,
} from "../domain/preoperational-checklist";
import {
  applicableItems,
  bogotaDateTime,
  MAX_NOTE_LENGTH,
  validateInspection,
  type AnswerStatus,
  type InspectionErrors,
} from "../domain/preoperational-inspection";
import { ChecklistTable, FillingInstructions, LABEL_CELL, LEFT_COLUMN_SECTIONS, RULE, SheetHeader } from "./form-sheet";
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

type HeaderEdits = Omit<Header, "date" | "time"> & {
  date: string | null;
  time: string | null;
  /** Registered driver picked from the list; null while the name is typed ("Otro") or unset. */
  selectedDriverId: number | null;
  /** The user chose the "type it yourself" option of the plate / trailer / driver picker. */
  plateOther: boolean;
  trailerOther: boolean;
  driverOther: boolean;
};

export type DriverOption = { id: number; name: string; nationalHint: string | null };

const EMPTY_EDITS: HeaderEdits = {
  date: null,
  time: null,
  plate: "",
  trailerPlate: "",
  driverName: "",
  driverId: "",
  odometer: "",
  route: "",
  selectedDriverId: null,
  plateOther: false,
  trailerOther: false,
  driverOther: false,
};

const HEADER_ORDER = ["date", "time", "plate", "trailerPlate", "driverName", "driverId", "odometer", "route"] as const;

/** Value of the "type it yourself" option of the pickers; no plate or driver id can equal it. */
const OTHER = "__other__";

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
export function PreoperationalFlow({
  plates,
  drivers,
}: {
  plates: readonly string[];
  drivers: readonly DriverOption[];
}) {
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
  return <InspectionForm key={round} plates={plates} drivers={drivers} onDone={setDone} />;
}

/** The form laid out like the paper sheet FO-PESV-016: header, data grid, checklist tables, novedades, firma. */
function InspectionForm({
  plates,
  drivers,
  onDone,
}: {
  plates: readonly string[];
  drivers: readonly DriverOption[];
  onDone: (result: Done) => void;
}) {
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

  const pickedDriver = header.driverOther ? undefined : drivers.find((d) => d.id === header.selectedDriverId);
  const registeredHint = pickedDriver?.nationalHint ?? null;

  const items = applicableItems(muleNotApplicable);
  const criticalItems = items.filter((item) => item.critical);
  const answeredCritical = criticalItems.filter((item) => answers[item.id]?.status).length;
  const answeredTotal = items.filter((item) => answers[item.id]?.status).length;

  // The MAL items, in sheet order, are the rows of the Novedades table.
  const failures = PREOPERATIONAL_CHECKLIST.flatMap((section, si) =>
    section.muleOnly && muleNotApplicable
      ? []
      : section.items.flatMap((item, ii) =>
          answers[item.id]?.status === "MAL" ? [{ item, number: itemNumber(si, ii) }] : [],
        ),
  );

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

  // Picker choices: a registered value, "" for none, or OTHER to type it.
  const pickPlate = (key: "plate" | "trailerPlate", choice: string) => {
    const flag = key === "plate" ? "plateOther" : "trailerOther";
    setHeader((h) => ({ ...h, [flag]: choice === OTHER, [key]: choice === OTHER ? "" : choice }));
    clearError(key);
  };

  const pickDriver = (choice: string) => {
    const picked = drivers.find((d) => String(d.id) === choice);
    setHeader((h) => ({
      ...h,
      driverOther: choice === OTHER,
      selectedDriverId: picked?.id ?? null,
      driverName: picked?.name ?? "",
      // A registered id is filled in by the server; the typed one only applies without it.
      driverId: picked?.nationalHint ? "" : h.driverId,
    }));
    clearError("driverName");
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
    if (!first) return;
    // A MAL item's error is its missing description, which lives in the Novedades table.
    const target = document.getElementById(answers[first]?.status === "MAL" ? noteId(first) : fieldId(first));
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    }
  };

  const submit = () => {
    // The "other" flags only drive the pickers; the server gets the header values.
    const sent = Object.fromEntries(HEADER_ORDER.map((key) => [key, header[key]]));
    const payload = { ...sent, selectedDriverId: header.selectedDriverId, muleNotApplicable, answers, signature: signature ?? "", website };
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

  const checklistTable = (sections: readonly ChecklistSection[], offset: number) => (
    <ChecklistTable
      sections={sections}
      offset={offset}
      sectionExtra={(section) =>
        section.muleOnly && (
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 font-medium normal-case">
            <input
              type="checkbox"
              className="size-6 shrink-0"
              checked={muleNotApplicable}
              onChange={(e) => setMuleNotApplicable(e.target.checked)}
            />
            No aplica (el vehículo no es mula)
          </label>
        )
      }
      renderBody={(section, sectionIndex) =>
        section.muleOnly && muleNotApplicable ? (
          <tr>
            <td colSpan={3} className={cn("border px-3 py-2 text-sm text-muted-foreground line-through", RULE)}>
              No aplica
            </td>
          </tr>
        ) : (
          section.items.map((item, itemIndex) => (
            <ChecklistRow
              key={item.id}
              item={item}
              number={itemNumber(sectionIndex, itemIndex)}
              status={answers[item.id]?.status}
              missing={Boolean(errors[item.id]) && !answers[item.id]?.status}
              onStatus={setStatus}
            />
          ))
        )
      }
    />
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-12">
      <SheetHeader />

      <form
        noValidate
        className="mt-5 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section aria-label="Datos de la inspección" className={cn("grid border-2 sm:grid-cols-2", RULE)}>
          <DataCell label="Fecha" name="date" type="date" value={header.date} error={errors.date} onChange={setField} />
          <DataCell label="Hora" name="time" type="time" value={header.time} error={errors.time} onChange={setField} />
          <PickerCell
            label="Placa"
            name="plate"
            required
            choices={plates.map((p) => ({ value: p, label: p }))}
            emptyLabel="Selecciona la placa"
            otherLabel="Otra placa (escribir)"
            selected={header.plateOther ? OTHER : header.plate}
            onPick={(choice) => pickPlate("plate", choice)}
            text={header.plate}
            onText={setField}
            error={errors.plate}
            autoCapitalize="characters"
            autoComplete="off"
            className="uppercase"
          />
          <PickerCell
            label="Placa remolque"
            name="trailerPlate"
            choices={plates.map((p) => ({ value: p, label: p }))}
            emptyLabel="Sin remolque"
            otherLabel="Otra placa (escribir)"
            selected={header.trailerOther ? OTHER : header.trailerPlate}
            onPick={(choice) => pickPlate("trailerPlate", choice)}
            text={header.trailerPlate}
            onText={setField}
            error={errors.trailerPlate}
            autoCapitalize="characters"
            autoComplete="off"
            className="uppercase"
          />
          <PickerCell
            label="Conductor"
            name="driverName"
            required
            choices={drivers.map((d) => ({ value: String(d.id), label: d.name }))}
            emptyLabel="Selecciona el conductor"
            otherLabel="Otro conductor (escribir)"
            selected={header.driverOther ? OTHER : header.selectedDriverId != null ? String(header.selectedDriverId) : ""}
            onPick={pickDriver}
            text={header.driverName}
            onText={setField}
            error={errors.driverName}
            autoComplete="name"
          />
          {registeredHint ? (
            <CellFrame label="Cédula" id={fieldId("driverId")}>
              <p id={fieldId("driverId")} tabIndex={-1} className="flex h-12 items-center px-3 text-base">
                {registeredHint} <span className="ml-1 text-sm text-muted-foreground">(registrada)</span>
              </p>
            </CellFrame>
          ) : (
            <DataCell
              label="Cédula"
              name="driverId"
              value={header.driverId}
              error={errors.driverId}
              onChange={setField}
              required
              inputMode="numeric"
              autoComplete="off"
            />
          )}
          <DataCell
            label="Kilometraje"
            name="odometer"
            value={header.odometer}
            error={errors.odometer}
            onChange={setField}
            inputMode="numeric"
            autoComplete="off"
          />
          <DataCell
            label="Ruta / destino"
            name="route"
            value={header.route}
            error={errors.route}
            onChange={setField}
            required
            autoComplete="off"
          />
        </section>

        <FillingInstructions />

        <div className="grid items-start gap-4 lg:grid-cols-2">
          {checklistTable(PREOPERATIONAL_CHECKLIST.slice(0, LEFT_COLUMN_SECTIONS), 0)}
          {checklistTable(PREOPERATIONAL_CHECKLIST.slice(LEFT_COLUMN_SECTIONS), LEFT_COLUMN_SECTIONS)}
        </div>
        <p className="text-right text-sm">
          <span className="text-destructive">★</span> Punto crítico (obligatorio): si está MAL el vehículo no sale.
        </p>

        <section aria-labelledby="novedades-heading" className="space-y-2">
          <SheetHeading id="novedades-heading">Novedades</SheetHeading>
          <p className="text-sm">
            Escriba qué está MAL y dónde. Ejemplo: <em>&quot;4 – llanta trasera derecha con corte&quot;</em>.
          </p>
          <table className={cn("w-full border-collapse border-2 text-base", RULE)}>
            <thead>
              <tr>
                <th scope="col" className={cn(LABEL_CELL, "w-24 text-left")}>
                  N.º punto
                </th>
                <th scope="col" className={cn(LABEL_CELL, "text-left")}>
                  Qué encontré
                </th>
              </tr>
            </thead>
            <tbody>
              {failures.length === 0 ? (
                <tr>
                  <td colSpan={2} className={cn("border px-3 py-3 text-sm text-muted-foreground", RULE)}>
                    Sin novedades. Si marca algún punto en MAL, aparece aquí para que lo describa.
                  </td>
                </tr>
              ) : (
                failures.map(({ item, number }) => (
                  <NovedadRow
                    key={item.id}
                    item={item}
                    number={number}
                    note={answers[item.id]?.note ?? ""}
                    error={errors[item.id]}
                    onNote={setNote}
                  />
                ))
              )}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="firma-heading" className="space-y-2">
          <SheetHeading id="firma-heading">Firmas</SheetHeading>
          <SignaturePad
            id={fieldId("signature")}
            invalid={Boolean(errors.signature)}
            onChange={(value) => {
              setSignature(value);
              if (value) clearError("signature");
            }}
          />
          <div className={cn("border-t-2 pt-1", RULE)}>
            <p className="text-sm font-bold">Firma del conductor</p>
            <p className="text-sm">Nombre: {header.driverName || "—"}</p>
          </div>
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

        <div className="mx-auto max-w-2xl space-y-3">
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {answeredCritical} de {criticalItems.length} críticos marcados · {answeredTotal} de {items.length} puntos en total
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
const noteId = (key: string) => `note-${key}`;

function SheetHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className={cn("border-b-2 pb-1 text-lg font-bold uppercase", RULE)}>
      {children}
    </h2>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

const CONTROL_CLASS =
  "h-12 w-full min-w-0 bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/70 focus-visible:ring-inset placeholder:text-muted-foreground";

/** One label/value box of the data grid, like the boxed header fields of the paper form. */
function CellFrame({
  label,
  id,
  required,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-[8.5rem_1fr] border", RULE, error && "bg-destructive/10")}>
      <label htmlFor={id} className={cn(LABEL_CELL, "flex items-center gap-1 border-0 border-r")}>
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </label>
      <div className="min-w-0">
        {children}
        {error && (
          <p id={`${id}-error`} role="alert" className="px-3 pb-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function DataCell({
  label,
  name,
  value,
  error,
  onChange,
  required,
  className,
  ...rest
}: {
  label: string;
  name: keyof Header;
  value: string;
  error?: string;
  onChange: (name: keyof Header, value: string) => void;
  required?: boolean;
} & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange">) {
  const id = fieldId(name);
  return (
    <CellFrame label={label} id={id} required={required} error={error}>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(CONTROL_CLASS, className)}
        {...rest}
      />
    </CellFrame>
  );
}

/**
 * A native select of registered values plus an "Otro (escribir)" option that reveals a text input.
 * The field id goes to whichever control is active, so error focus lands on it.
 */
function PickerCell({
  label,
  name,
  choices,
  emptyLabel,
  otherLabel,
  selected,
  onPick,
  text,
  onText,
  error,
  required,
  className,
  ...rest
}: {
  label: string;
  name: keyof Header;
  choices: readonly { value: string; label: string }[];
  emptyLabel: string;
  otherLabel: string;
  selected: string;
  onPick: (choice: string) => void;
  text: string;
  onText: (name: keyof Header, value: string) => void;
  error?: string;
  required?: boolean;
} & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange">) {
  const id = fieldId(name);
  const typing = selected === OTHER;
  const described = error ? `${id}-error` : undefined;
  return (
    <CellFrame label={label} id={id} required={required} error={error}>
      <select
        id={typing ? `${id}-select` : id}
        aria-label={label}
        value={selected}
        onChange={(e) => onPick(e.target.value)}
        aria-invalid={error && !typing ? true : undefined}
        aria-describedby={described}
        className={cn(CONTROL_CLASS, "cursor-pointer")}
      >
        <option value="">{emptyLabel}</option>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
        <option value={OTHER}>{otherLabel}</option>
      </select>
      {typing && (
        <input
          id={id}
          name={name}
          value={text}
          onChange={(e) => onText(name, e.target.value)}
          aria-label={`${label} (escribir)`}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          placeholder={`Escribe: ${label.toLowerCase()}`}
          className={cn(CONTROL_CLASS, "border-t", RULE, className)}
          {...rest}
        />
      )}
    </CellFrame>
  );
}

function ChecklistRow({
  item,
  number,
  status,
  missing,
  onStatus,
}: {
  item: ChecklistItem;
  number: string;
  status?: AnswerStatus;
  missing: boolean;
  onStatus: (item: ChecklistItem, status: AnswerStatus) => void;
}) {
  const labelId = `label-${item.id}`;
  return (
    <tr
      id={fieldId(item.id)}
      tabIndex={-1}
      className={cn("outline-none", missing && "bg-destructive/10")}
    >
      <td id={labelId} className={cn("border px-3 py-2 leading-snug", RULE)}>
        {item.critical && (
          <span className="mr-1 text-destructive" aria-label="Punto crítico, obligatorio">
            ★
          </span>
        )}
        <span className="sr-only">{number} </span>
        {item.label}
      </td>
      <BoxCell item={item} value="BIEN" checked={status === "BIEN"} onSelect={onStatus} />
      <BoxCell item={item} value="MAL" checked={status === "MAL"} onSelect={onStatus} />
    </tr>
  );
}

/** The paper form's checkbox: a square that takes an X. A radio underneath, so BIEN and MAL exclude each other. */
function BoxCell({
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
    <td className={cn("border p-0", RULE)}>
      <label className="flex h-12 cursor-pointer items-center justify-center">
        <input
          type="radio"
          name={`answer-${item.id}`}
          value={value}
          checked={checked}
          onChange={() => onSelect(item, value)}
          aria-label={`${value}: ${item.label}`}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "flex size-8 items-center justify-center rounded-sm border-2 border-foreground/70 bg-background text-xl leading-none font-black select-none",
            "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/70",
            value === "BIEN"
              ? "peer-checked:border-ok-foreground peer-checked:bg-ok peer-checked:text-ok-foreground"
              : "peer-checked:border-danger-foreground peer-checked:bg-danger-foreground peer-checked:text-white",
          )}
        >
          {checked ? "X" : ""}
        </span>
      </label>
    </td>
  );
}

function NovedadRow({
  item,
  number,
  note,
  error,
  onNote,
}: {
  item: ChecklistItem;
  number: string;
  note: string;
  error?: string;
  onNote: (item: ChecklistItem, note: string) => void;
}) {
  const id = noteId(item.id);
  return (
    <tr className={cn(error && "bg-destructive/10")}>
      <td className={cn("border px-3 py-2 align-top font-bold", RULE)}>{number}</td>
      <td className={cn("space-y-1.5 border px-3 py-2", RULE)}>
        <label htmlFor={id} className="block text-sm text-muted-foreground">
          {item.critical && <span className="mr-1 text-destructive">★</span>}
          {item.label}
        </label>
        <Textarea
          id={id}
          value={note}
          onChange={(e) => onNote(item, e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          aria-invalid={error ? true : undefined}
          placeholder="Qué encontré y dónde"
          className="min-h-16 text-base"
        />
        {error && <ErrorText>{error}</ErrorText>}
      </td>
    </tr>
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
