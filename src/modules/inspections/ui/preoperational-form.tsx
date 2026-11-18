"use client";

import {
  BedDouble,
  CircleAlert,
  CircleCheck,
  Fuel,
  Gauge,
  IdCard,
  Lock,
  MapPin,
  RectangleHorizontal,
  Route,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitInspectionAction, type SubmitInspectionResult } from "../application/inspection-actions";
import {
  PREOPERATIONAL_CHECKLIST,
  canBeNotApplicable,
  itemNumber,
  type ChecklistItem,
  type ChecklistSection,
} from "../domain/preoperational-checklist";
import {
  applicableItems,
  bogotaDateTime,
  FUEL_OPTIONS,
  MAX_LOCATION_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PENDING_MAINTENANCE_LENGTH,
  MAX_REST_HOURS_LENGTH,
  validateInspection,
  type AnswerStatus,
  type InspectionErrors,
} from "../domain/preoperational-inspection";
import { FormStepTabs, STEP_ICONS, type FormStep } from "./form-step-tabs";
import { ChecklistTable, FillingInstructions, LABEL_CELL, LEFT_COLUMN_SECTIONS, RULE, SheetHeader } from "./form-sheet";
import { PlateText } from "@/components/app/plate-text";
import { DictateButton } from "./dictate-button";
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

/** The "Parte diario" tab: typed text, validated and parsed by the domain on submit. */
type DailyFields = { restHours: string; location: string; fuel: string; pendingMaintenance: string };

const EMPTY_DAILY: DailyFields = { restHours: "", location: "", fuel: "", pendingMaintenance: "" };

const DAILY_ORDER = ["restHours", "location", "fuel", "pendingMaintenance"] as const;

type FormTab = "inspection" | "daily";

const TAB_PREFIX = "form-tab";
const TAB_PANEL = "form-tabpanel";

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

/** The public page: the form, then a "sent" confirmation, then back to a blank form. */
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
  // Ids of the sections the inspector marked "no aplica".
  const [notApplicable, setNotApplicable] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, Draft>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [tab, setTab] = useState<FormTab>("inspection");
  const [daily, setDailyState] = useState<DailyFields>(EMPTY_DAILY);
  const [errors, setErrors] = useState<InspectionErrors>({});
  const [pending, startTransition] = useTransition();

  const header = { ...edits, date: edits.date ?? defaults.date, time: edits.time ?? defaults.time };

  const pickedDriver = header.driverOther ? undefined : drivers.find((d) => d.id === header.selectedDriverId);
  const registeredHint = pickedDriver?.nationalHint ?? null;

  const items = applicableItems(notApplicable);
  const criticalItems = items.filter((item) => item.critical);
  const answeredCritical = criticalItems.filter((item) => answers[item.id]?.status).length;
  const answeredTotal = items.filter((item) => answers[item.id]?.status).length;

  // The MAL items, in sheet order, are the rows of the Novedades table.
  const failures = PREOPERATIONAL_CHECKLIST.flatMap((section, si) =>
    notApplicable.includes(section.id)
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

  const setDaily = (key: keyof DailyFields, value: string) => {
    setDailyState((d) => ({ ...d, [key]: value }));
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
    // The first tab with an error wins; within a tab, the first field in form order.
    const inspectionFirst = [...HEADER_ORDER, ...items.map((i) => i.id), "signature"].find((key) => key in found);
    const first = inspectionFirst ?? DAILY_ORDER.find((key) => key in found);
    // The target must be visible to take focus, so the tab switch is committed first.
    flushSync(() => {
      setErrors(found);
      if (first) setTab(inspectionFirst ? "inspection" : "daily");
    });
    if (!first) return;
    // A MAL item's error is its missing description, which lives in the Novedades table.
    const target = document.getElementById(answers[first]?.status === "MAL" ? noteId(first) : fieldId(first));
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    }
  };

  // The "other" flags only drive the pickers; the server gets the header values.
  const payload = {
    ...Object.fromEntries(HEADER_ORDER.map((key) => [key, header[key]])),
    ...daily,
    selectedDriverId: header.selectedDriverId,
    notApplicableSections: notApplicable,
    answers,
    signature: signature ?? "",
    website,
  };
  // Validated on every render so "Enviar" stays locked until both steps are really complete.
  const check = validateInspection(payload);
  const dailyKeys: readonly string[] = DAILY_ORDER;
  const pendingKeys = check.ok ? [] : Object.keys(check.errors).filter((key) => key !== "form");
  const inspectionReady = !pendingKeys.some((key) => !dailyKeys.includes(key));
  const dailyReady = !pendingKeys.some((key) => dailyKeys.includes(key));
  const ready = check.ok;

  const submit = () => {
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

  const dailyFilled = DAILY_ORDER.filter((key) => daily[key].trim()).length;
  const steps: ReadonlyArray<FormStep<FormTab>> = [
    {
      key: "inspection",
      title: "Preoperacional",
      hint: "Revisión del vehículo y firma",
      icon: STEP_ICONS.inspection,
      progress: `${answeredTotal} de ${items.length} puntos`,
      complete: inspectionReady,
      hasError: Object.keys(errors).some((key) => key !== "form" && !dailyKeys.includes(key)),
    },
    {
      key: "daily",
      title: "Parte diario",
      hint: "Descanso, ubicación, combustible",
      icon: STEP_ICONS.daily,
      progress: `${dailyFilled} de ${DAILY_ORDER.length} datos`,
      complete: dailyReady,
      hasError: DAILY_ORDER.some((key) => key in errors),
    },
  ];

  const goToStep = (key: FormTab) => {
    flushSync(() => setTab(key));
    document.getElementById(`${TAB_PREFIX}-${key}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const toggleNotApplicable = (section: ChecklistSection, checked: boolean) => {
    setNotApplicable((current) => (checked ? [...current.filter((id) => id !== section.id), section.id] : current.filter((id) => id !== section.id)));
    for (const item of section.items) clearError(item.id);
  };

  const checklistTable = (sections: readonly ChecklistSection[], offset: number) => (
    <ChecklistTable
      sections={sections}
      offset={offset}
      sectionExtra={(section) =>
        canBeNotApplicable(section) && (
          <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 text-lg font-semibold normal-case">
            <input
              type="checkbox"
              className="size-7 shrink-0"
              checked={notApplicable.includes(section.id)}
              onChange={(e) => toggleNotApplicable(section, e.target.checked)}
            />
            {section.notApplicableLabel}
          </label>
        )
      }
      renderBody={(section, sectionIndex) =>
        notApplicable.includes(section.id) ? (
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
        <FormStepTabs
          label="Pasos del formulario"
          steps={steps}
          active={tab}
          onSelect={setTab}
          idPrefix={TAB_PREFIX}
          panelId={TAB_PANEL}
        />

        <div id={TAB_PANEL} className="space-y-6">
          <div
            role="tabpanel"
            id={`${TAB_PANEL}-inspection`}
            aria-labelledby={`${TAB_PREFIX}-inspection`}
            hidden={tab !== "inspection"}
            className="space-y-6"
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

            <Button
              type="button"
              variant="outline"
              className="mx-auto flex h-16 w-full max-w-2xl border-2 border-foreground bg-primary text-lg font-bold text-primary-foreground hover:bg-accent"
              onClick={() => goToStep("daily")}
            >
              Siguiente: 2. Parte diario →
            </Button>
          </div>

          <div
            role="tabpanel"
            id={`${TAB_PANEL}-daily`}
            aria-labelledby={`${TAB_PREFIX}-daily`}
            hidden={tab !== "daily"}
          >
            <DailyReportPanel
              summary={{
                driverName: header.driverName,
                plate: header.plate,
                odometer: header.odometer,
                route: header.route,
              }}
              values={daily}
              errors={errors}
              onChange={setDaily}
            />
            <Button
              type="button"
              variant="ghost"
              className="mx-auto mt-4 flex h-14 w-full max-w-2xl text-lg"
              onClick={() => goToStep("inspection")}
            >
              ← Volver a 1. Preoperacional
            </Button>
          </div>
        </div>

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
          {/* Only real send failures (e.g. no connection); missing fields are listed in the lock box. */}
          {errors.form && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-base font-medium text-destructive">
              {errors.form}
            </p>
          )}
          <Button
            type="submit"
            className="h-14 w-full text-lg disabled:opacity-50"
            disabled={pending || !ready}
            aria-busy={pending}
          >
            {pending ? "Enviando…" : ready ? "Enviar inspección" : (
              <>
                <Lock aria-hidden className="size-5" />
                Enviar inspección
              </>
            )}
          </Button>
        </div>
      </form>
    </main>
  );
}

const dash = (value: string) => value.trim() || "—";

const NONE = "Ninguno";

/** Daily-report inputs: a dark 2px edge so the empty box reads on white (the default input edge is too pale). */
const DRIVER_CONTROL =
  "border-2 border-foreground/45 bg-card text-foreground hover:border-foreground/70 focus-visible:border-foreground focus-visible:ring-brand/40";

/**
 * The "Parte diario" tab, built for older drivers on a phone: real icons (emoji render as boxes on
 * some Androids), large type, 56px controls, visible helper text instead of placeholders, dictation
 * on the free-text fields and two big buttons for the fuel so nobody has to fight the keyboard.
 */
function DailyReportPanel({
  summary,
  values,
  errors,
  onChange,
}: {
  summary: { driverName: string; plate: string; odometer: string; route: string };
  values: DailyFields;
  errors: InspectionErrors;
  onChange: (key: keyof DailyFields, value: string) => void;
}) {
  const describedBy = (key: keyof DailyFields) =>
    [`${fieldId(key)}-hint`, errors[key] ? `${fieldId(key)}-error` : null].filter(Boolean).join(" ");
  const noPending = values.pendingMaintenance.trim() === NONE;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section aria-labelledby="daily-summary-heading" className="rounded-2xl border-2 border-foreground/15 bg-muted p-4">
        <h2 id="daily-summary-heading" className="text-base font-bold text-foreground">
          Datos del paso 1
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <SummaryItem icon={IdCard} label="Conductor" value={dash(summary.driverName)} />
          <SummaryItem
            icon={RectangleHorizontal}
            label="Placa"
            value={summary.plate.trim() ? <PlateText plate={summary.plate} /> : "—"}
          />
          <SummaryItem icon={Gauge} label="Kilometraje" value={dash(summary.odometer)} />
          <SummaryItem icon={Route} label="Ruta asignada" value={dash(summary.route)} />
        </dl>
      </section>

      <DailyField
        step={1}
        icon={BedDouble}
        label="Horas de descanso"
        hint="¿Cuánto descansó antes de salir? Ejemplo: 8 horas, de 9 p. m. a 5 a. m."
        name="restHours"
        done={Boolean(values.restHours.trim())}
        error={errors.restHours}
      >
        <Input
          id={fieldId("restHours")}
          value={values.restHours}
          onChange={(e) => onChange("restHours", e.target.value)}
          maxLength={MAX_REST_HOURS_LENGTH}
          aria-invalid={errors.restHours ? true : undefined}
          aria-describedby={describedBy("restHours")}
          autoComplete="off"
          enterKeyHint="next"
          className={cn("h-14 text-lg", DRIVER_CONTROL)}
        />
        <DictateButton
          size="large"
          value={values.restHours}
          onChange={(value) => onChange("restHours", value)}
          maxLength={MAX_REST_HOURS_LENGTH}
          label="horas de descanso"
        />
      </DailyField>

      <DailyField
        step={2}
        icon={MapPin}
        label="Ubicación"
        hint="Ciudad o sitio donde está ahora."
        name="location"
        done={Boolean(values.location.trim())}
        error={errors.location}
      >
        <Input
          id={fieldId("location")}
          value={values.location}
          onChange={(e) => onChange("location", e.target.value)}
          maxLength={MAX_LOCATION_LENGTH}
          aria-invalid={errors.location ? true : undefined}
          aria-describedby={describedBy("location")}
          autoComplete="off"
          enterKeyHint="next"
          className={cn("h-14 text-lg", DRIVER_CONTROL)}
        />
        <DictateButton
          size="large"
          value={values.location}
          onChange={(value) => onChange("location", value)}
          maxLength={MAX_LOCATION_LENGTH}
          label="ubicación"
        />
      </DailyField>

      <DailyField
        step={3}
        icon={Fuel}
        label="Combustible"
        hint="¿Hay que tanquear?"
        name="fuel"
        done={FUEL_OPTIONS.some((option) => option === values.fuel)}
        error={errors.fuel}
      >
        <div role="radiogroup" aria-labelledby={`${fieldId("fuel")}-label`} aria-describedby={describedBy("fuel")} className="space-y-3">
          {FUEL_OPTIONS.map((option, index) => {
            const selected = values.fuel === option;
            return (
              <label
                key={option}
                className={cn(
                  "flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-lg font-bold select-none transition-colors duration-150 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/70",
                  selected
                    ? index === 0
                      ? "border-warn-foreground bg-warn text-warn-foreground"
                      : "border-ok-foreground bg-ok text-ok-foreground"
                    : "border-foreground/60 bg-card text-foreground hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="fuel"
                  id={index === 0 ? fieldId("fuel") : undefined}
                  value={option}
                  checked={selected}
                  onChange={() => onChange("fuel", option)}
                  className="sr-only"
                />
                {selected && <CircleCheck aria-hidden className="size-6" />}
                {option}
              </label>
            );
          })}
        </div>
      </DailyField>

      <DailyField
        step={4}
        icon={Wrench}
        label="Mantenimiento pendiente"
        hint="¿Hay algo por arreglar? Si no, toque «No hay pendientes»."
        name="pendingMaintenance"
        done={Boolean(values.pendingMaintenance.trim())}
        error={errors.pendingMaintenance}
      >
        <button
          type="button"
          aria-pressed={noPending}
          onClick={() => onChange("pendingMaintenance", noPending ? "" : NONE)}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl border-4 text-lg font-bold outline-none select-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/70 active:scale-[0.98] motion-reduce:active:scale-100",
            noPending ? "border-ok-foreground bg-ok text-ok-foreground" : "border-foreground/60 bg-card text-foreground hover:bg-muted",
          )}
        >
          <CircleCheck aria-hidden className="size-6" />
          No hay pendientes
        </button>
        {!noPending && (
          <>
            <p className="text-center text-base font-medium text-foreground/80">o escriba qué falta:</p>
            <Textarea
              id={fieldId("pendingMaintenance")}
              value={values.pendingMaintenance}
              onChange={(e) => onChange("pendingMaintenance", e.target.value)}
              maxLength={MAX_PENDING_MAINTENANCE_LENGTH}
              rows={3}
              aria-invalid={errors.pendingMaintenance ? true : undefined}
              aria-describedby={describedBy("pendingMaintenance")}
              className={cn("min-h-24 text-lg", DRIVER_CONTROL)}
            />
            <DictateButton
              size="large"
              value={values.pendingMaintenance}
              onChange={(value) => onChange("pendingMaintenance", value)}
              maxLength={MAX_PENDING_MAINTENANCE_LENGTH}
              label="mantenimiento pendiente"
            />
          </>
        )}
      </DailyField>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon aria-hidden className="mt-1 size-6 shrink-0 text-foreground" />
      <div className="min-w-0">
        <dt className="text-base text-foreground/75">{label}</dt>
        <dd className="text-lg leading-snug font-bold break-words">{value}</dd>
      </div>
    </div>
  );
}

/** One numbered card of the daily report: icon, big label, visible hint, the control(s) and its error. */
function DailyField({
  step,
  icon: Icon,
  label,
  hint,
  name,
  done,
  error,
  children,
}: {
  step: number;
  icon: LucideIcon;
  label: string;
  hint: string;
  name: keyof DailyFields;
  done: boolean;
  error?: string;
  children: ReactNode;
}) {
  const id = fieldId(name);
  const ok = done && !error;
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className={cn(
        "space-y-3 rounded-2xl border-2 border-foreground/20 bg-card p-4 shadow-soft",
        error ? "border-destructive bg-destructive/5" : ok && "border-ok-foreground/60 bg-ok/30",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            ok ? "bg-ok text-ok-foreground ring-2 ring-ok-foreground/40" : "bg-primary text-primary-foreground ring-2 ring-foreground/80",
          )}
        >
          {ok ? <CircleCheck className="size-6" /> : <Icon className="size-6" />}
        </span>
        <label id={`${id}-label`} htmlFor={id} className="min-w-0 text-xl leading-tight font-bold">
          <span className="sr-only">Dato {step} de 4: </span>
          {label}
          <span aria-hidden className="ml-1 text-destructive">
            *
          </span>
        </label>
      </div>
      <p id={`${id}-hint`} className="text-base text-foreground/80">
        {hint}
      </p>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-2 text-base font-semibold text-destructive">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}
    </div>
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
        <DictateButton
          value={note}
          onChange={(value) => onNote(item, value)}
          maxLength={MAX_NOTE_LENGTH}
          label={`qué encontré en ${item.label}`}
        />
        {error && <ErrorText>{error}</ErrorText>}
      </td>
    </tr>
  );
}

/** Neutral confirmation: the exit decision belongs to maintenance, not to this screen. */
function ResultScreen({ onAnother }: { onAnother: () => void }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <CircleCheck className="size-20 text-ok-foreground" aria-hidden />
      <div role="status" className="max-w-md space-y-3">
        <h1 className="text-3xl leading-tight font-bold tracking-tight">Formulario enviado</h1>
        <p className="text-lg text-muted-foreground">La inspección preoperacional quedó registrada correctamente.</p>
      </div>
      <Button type="button" onClick={onAnother} className="h-14 w-full max-w-md text-lg">
        Enviar otra inspección
      </Button>
    </main>
  );
}
