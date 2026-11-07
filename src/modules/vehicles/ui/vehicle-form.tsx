"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import { expireVehicleViewsAction, updateTechnicalDataAction, type ActionResult } from "../application/vehicle-actions";
import { createBodyFromForm, editBodyFromForm } from "../application/vehicle-form-body";
import type { VehicleEditValues, VehicleFormOptions } from "../application/vehicle-queries";
import { technicalDataSchema } from "../application/vehicle-action-schemas";
import { assertModelYear, EMPTY_TECHNICAL_DATA, type VehicleTechnicalData } from "../domain/technical-data";
import { MunicipalityPicker } from "@/modules/shared/ui/municipality-picker";
import { TechnicalFields } from "./vehicle-action-forms";
import { TrailerSelect } from "./trailer-select";

const FIELD = "h-10 md:h-9";
/** Selects match the input height so paired controls line up. */
const SELECT = "h-10 md:h-9";

const STATUS_LABELS = { ACTIVE: "Activo", IDLE: "Inactivo", IN_WORKSHOP: "En taller" } as const;
const OIL_MODE_LABELS = { both: "Fecha y kilometraje", km: "Solo kilometraje", date: "Solo fecha" } as const;

const formValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));

/** Sends a body to the vehicles API and maps the reply to an `ActionResult` (plus the saved plate). */
async function sendVehicle(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<ActionResult & { plate?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, message: data.message, plate: data.plate };
    if (res.status === 401) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    const issue = data.issues?.[0];
    return {
      ok: false,
      error: issue ? `Revisa ${issue.path || "los datos"}: ${issue.message}` : (data.error ?? "No se pudo guardar."),
    };
  } catch {
    return { ok: false, error: "No se pudo conectar. Intenta de nuevo." };
  }
}

/**
 * Titled block of the form; every block after the first gets a divider.
 * `step` numbers the blocks of the long create form.
 */
function Section({
  title,
  hint,
  step,
  optional,
  children,
}: {
  title: string;
  hint?: string;
  step?: number;
  optional?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0"
    >
      <div className="flex items-start gap-3">
        {step != null ? (
          <span
            aria-hidden
            className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground),transparent_85%)]"
          >
            {step}
          </span>
        ) : (
          <span aria-hidden className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-primary" />
        )}
        <div className="min-w-0 space-y-1 pt-0.5">
          <h3 id={headingId} className="flex items-center gap-2 text-base leading-tight font-semibold tracking-tight">
            {title}
            {optional && <span className="micro-label">Opcional</span>}
          </h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Small caption that splits a section into named groups of fields. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
      <p className="micro-label">{label}</p>
      {children}
    </div>
  );
}

/** Two columns whose controls line up even when one label wraps; stacks on narrow phones. */
function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-end gap-3 min-[400px]:grid-cols-2">{children}</div>;
}

/** Checkbox row with a 44px touch target. */
function CheckboxField({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm select-none">
      <input
        type="checkbox"
        name={name}
        className="size-5 shrink-0 cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * Plate, class, brand, municipality, service, oil mode, trailer and notes: shared by create and edit.
 * A trailer (class Remolque) only has plate and class here: `isTrailer` hides the rest, and
 * `lockClass` (editing an existing trailer) keeps its class in a hidden field instead of a picker.
 */
function VehicleDataFields({
  options,
  values,
  idPrefix,
  step,
  isTrailer,
  lockClass = false,
  onClassChange,
  withTrailer = false,
}: {
  options: VehicleFormOptions;
  values?: VehicleEditValues;
  idPrefix: string;
  step?: number;
  isTrailer: boolean;
  lockClass?: boolean;
  onClassChange: (classId: number | null) => void;
  /** Offer the trailer picker (create form; the vehicle file anchors it from its own action). */
  withTrailer?: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <Section title={isTrailer ? "Remolque" : "Vehículo"} step={step}>
      <Group label="Identificación">
        <Row>
          <Field label="Placa" htmlFor={id("plate")} required>
            <Input
              id={id("plate")}
              name="plate"
              className={`${FIELD} num uppercase`}
              defaultValue={values?.plate}
              placeholder={isTrailer ? "S88490" : "ABC123"}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </Field>
          {lockClass ? (
            <input type="hidden" name="classId" value={values?.classId} />
          ) : (
            <Field label="Clase" htmlFor={id("class")} required>
              <NativeSelect
                id={id("class")}
                name="classId"
                className={SELECT}
                defaultValue={values?.classId ?? ""}
                onChange={(e) => onClassChange(e.target.value === "" ? null : Number(e.target.value))}
                required
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {options.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </Row>
        {!isTrailer && (
          <Field label="Marca y línea" htmlFor={id("brand")}>
            <Input
              id={id("brand")}
              name="brandLine"
              className={FIELD}
              placeholder="Ej. Kenworth T800"
              defaultValue={values?.brandLine ?? ""}
            />
          </Field>
        )}
      </Group>

      {!isTrailer && (
        <>
          <Group label="Matrícula">
            <Row>
              <MunicipalityPicker idPrefix={id("place")} defaultValue={values?.municipality} selectClassName={SELECT} />
            </Row>
            <Row>
              <Field label="Servicio" htmlFor={id("service")}>
                <NativeSelect id={id("service")} name="serviceType" className={SELECT} defaultValue={values?.serviceType ?? "PARTICULAR"}>
                  <option value="PARTICULAR">Particular</option>
                  <option value="PUBLICO">Público</option>
                </NativeSelect>
              </Field>
            </Row>
          </Group>

          {withTrailer && <TrailerSelect id={id("trailer")} trailers={options.trailers} />}

          <Field label="Controlar el aceite por" htmlFor={id("oilmode")} hint="Define cuándo se avisa el próximo cambio.">
            <NativeSelect id={id("oilmode")} name="oilMode" className={SELECT} defaultValue={values?.oilMode ?? "both"}>
              {Object.entries(OIL_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notas" htmlFor={id("notes")}>
            <Textarea id={id("notes")} name="notes" rows={2} defaultValue={values?.notes ?? ""} />
          </Field>
        </>
      )}
    </Section>
  );
}

function OwnerFields({ options, step }: { options: VehicleFormOptions; step?: number }) {
  const [choice, setChoice] = useState("");
  return (
    <Section title="Propietario" step={step} optional hint="Puedes asignarlo después con Traspasar.">
      <Field label="¿A nombre de quién está?" htmlFor="nv-owner">
        <NativeSelect
          id="nv-owner"
          name="ownerChoice"
          className={SELECT}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">Sin registrar</option>
          {options.imperioOwnerId == null && <option value="IMPERIO">{KNOWN_OWNERS.IMPERIO.name}</option>}
          {options.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="NEW">Otro propietario (nuevo)…</option>
        </NativeSelect>
      </Field>
      {choice === "NEW" && (
        <Group label="Nuevo propietario">
          <Row>
            <Field label="Nombre" htmlFor="nv-owner-name" required>
              <Input id="nv-owner-name" name="ownerName" className={FIELD} autoComplete="off" required />
            </Field>
            <Field label="Documento" htmlFor="nv-owner-doc">
              <Input id="nv-owner-doc" name="ownerDocument" inputMode="numeric" className={FIELD} />
            </Field>
          </Row>
        </Group>
      )}
      {choice !== "" && (
        <Field label="Propietario desde" htmlFor="nv-owner-date" required>
          <Input
            id="nv-owner-date"
            name="ownerDate"
            type="date"
            className={FIELD}
            defaultValue={options.today}
            max={options.today}
            required
          />
        </Field>
      )}
    </Section>
  );
}

function DriverFields({ options, step }: { options: VehicleFormOptions; step?: number }) {
  const [choice, setChoice] = useState("");
  return (
    <Section title="Conductor" step={step} optional hint="Puedes asignarlo después.">
      <Field label="¿Quién lo maneja?" htmlFor="nv-driver">
        <NativeSelect
          id="nv-driver"
          name="driverChoice"
          className={SELECT}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">Sin asignar</option>
          {options.drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.nationalId ? ` · ${d.nationalId}` : ""}
            </option>
          ))}
          <option value="NEW">Crear conductor nuevo…</option>
        </NativeSelect>
      </Field>
      {choice === "NEW" && (
        <Group label="Nuevo conductor">
          <Field label="Nombre completo" htmlFor="nv-driver-name" required>
            <Input id="nv-driver-name" name="driverName" className={FIELD} autoComplete="off" required />
          </Field>
          <Row>
            <Field label="Cédula" htmlFor="nv-driver-id">
              <Input id="nv-driver-id" name="driverNationalId" inputMode="numeric" className={FIELD} />
            </Field>
            <Field label="Celular" htmlFor="nv-driver-phone">
              <Input id="nv-driver-phone" name="driverPhone" type="tel" autoComplete="off" className={FIELD} />
            </Field>
          </Row>
        </Group>
      )}
      {choice !== "" && (
        <Field label="Maneja desde" htmlFor="nv-driver-date" required>
          <Input
            id="nv-driver-date"
            name="driverDate"
            type="date"
            className={FIELD}
            defaultValue={options.today}
            max={options.today}
            required
          />
        </Field>
      )}
    </Section>
  );
}

function DocumentDateField({ prefix, label }: { prefix: "soat" | "tecno"; label: string }) {
  const [notApplicable, setNotApplicable] = useState(false);
  return (
    <div>
      <Field label={`${label} vence`} htmlFor={`nv-${prefix}`}>
        <Input
          id={`nv-${prefix}`}
          name={`${prefix}ExpiresOn`}
          type="date"
          className={FIELD}
          disabled={notApplicable}
        />
      </Field>
      <CheckboxField
        name={`${prefix}NotApplicable`}
        label="No aplica"
        checked={notApplicable}
        onChange={setNotApplicable}
      />
    </div>
  );
}

function DocumentFields({ options, step }: { options: VehicleFormOptions; step?: number }) {
  const [taxKind, setTaxKind] = useState("");
  return (
    <Section title="Documentos e impuesto" step={step} optional hint="Deja en blanco lo que no tengas a mano.">
      <Group label="Obligatorios">
        <Row>
          <DocumentDateField prefix="soat" label="SOAT" />
          <DocumentDateField prefix="tecno" label="Tecno" />
        </Row>
      </Group>
      <Group label="Póliza">
        <Row>
          <Field label="Tipo" htmlFor="nv-policy-kind">
            <NativeSelect id="nv-policy-kind" name="policyKind" className={SELECT} defaultValue="TR">
              <option value="TR">Todo riesgo</option>
              <option value="RC">Responsabilidad civil</option>
            </NativeSelect>
          </Field>
          <Field label="Vence" htmlFor="nv-policy-date">
            <Input id="nv-policy-date" name="policyExpiresOn" type="date" className={FIELD} />
          </Field>
        </Row>
      </Group>
      <Row>
        <Field label="Impuesto vehicular" htmlFor="nv-tax">
          <NativeSelect
            id="nv-tax"
            name="taxKind"
            className={SELECT}
            value={taxKind}
            onChange={(e) => setTaxKind(e.target.value)}
          >
            <option value="">Sin registrar</option>
            <option value="PAID_YEAR">Pagado</option>
            <option value="EXEMPT">Exento</option>
            <option value="EXEMPT_LOW_DISPLACEMENT">Exento por cilindraje</option>
          </NativeSelect>
        </Field>
        {taxKind === "PAID_YEAR" && (
          <Field label="Año pagado" htmlFor="nv-tax-year" required>
            <Input
              id="nv-tax-year"
              name="taxYear"
              inputMode="numeric"
              className={FIELD}
              defaultValue={options.today.slice(0, 4)}
              required
            />
          </Field>
        )}
      </Row>
    </Section>
  );
}

function MaintenanceFields({ options, step }: { options: VehicleFormOptions; step?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <Section title="Estado y mantenimiento" step={step}>
      <Group label="Estado actual">
        <Row>
          <Field label="Estado" htmlFor="nv-status">
            <NativeSelect id="nv-status" name="status" className={SELECT} defaultValue="ACTIVE">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Kilometraje actual (km)" htmlFor="nv-km">
            <Input
              id="nv-km"
              name="currentKm"
              inputMode="numeric"
              className={`${FIELD} num`}
              placeholder={broken ? "Sin odómetro" : "Ej. 125000"}
              disabled={broken}
            />
          </Field>
        </Row>
        <CheckboxField
          name="odometerBroken"
          label="El odómetro no funciona"
          checked={broken}
          onChange={setBroken}
        />
      </Group>
      <Group label="Último cambio de aceite">
        <Row>
          <Field label="Fecha" htmlFor="nv-oil-date">
            <Input id="nv-oil-date" name="oilDate" type="date" className={FIELD} max={options.today} />
          </Field>
          <Field label="Kilometraje (km)" htmlFor="nv-oil-km">
            <Input
              id="nv-oil-km"
              name="oilKm"
              inputMode="numeric"
              className={`${FIELD} num`}
              placeholder={broken ? "Sin odómetro" : undefined}
              disabled={broken}
            />
          </Field>
        </Row>
      </Group>
    </Section>
  );
}

/** First problem in the technical-sheet fields of the form, or null when they can be saved. */
function technicalDataError(fd: FormData, today: VehicleFormOptions["today"]): string | null {
  const parsed = technicalDataSchema.safeParse(Object.fromEntries(fd.entries()));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Revisa los datos técnicos.";
  try {
    assertModelYear(parsed.data.modelYear ?? null, today);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Revisa el modelo.";
  }
}

/** "Nuevo vehículo" button with the full create form; opens the new vehicle's file when saved. */
export function NewVehicleButton({ options }: { options: VehicleFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<number | null>(null);
  const isTrailer = options.classes.find((c) => c.id === classId)?.isTrailer ?? false;
  return (
    <>
      <Button className="h-11 px-4 md:h-10" onClick={() => {
          setClassId(null);
          setOpen(true);
        }}>
        <Plus aria-hidden />
        Nuevo vehículo
      </Button>
      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title="Nuevo vehículo"
        description={isTrailer ? "Solo placa y propietario." : "Solo placa y clase son obligatorias."}
        wide
      >
        <ActionForm
          action={async (fd) => {
            // Check the technical sheet before creating, so a bad value never leaves a half-saved vehicle.
            const techError = isTrailer ? null : technicalDataError(fd, options.today);
            if (techError) return { ok: false, error: techError };
            const result = await sendVehicle("/api/vehiculos", "POST", createBodyFromForm(formValues(fd)));
            if (!result.ok) return result;
            if (result.plate && !isTrailer) {
              const tech = await updateTechnicalDataAction(result.plate, fd);
              if (!tech.ok) {
                return { ok: false, error: `El vehículo se creó, pero no se guardaron los datos técnicos: ${tech.error}` };
              }
            }
            await expireVehicleViewsAction().catch(() => undefined);
            if (result.plate) router.push(`/flota/${encodeURIComponent(result.plate)}`);
            return result;
          }}
          submitLabel="Crear vehículo"
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          <VehicleDataFields
            options={options}
            idPrefix="nv"
            step={1}
            isTrailer={isTrailer}
            onClassChange={setClassId}
            withTrailer
          />
          <OwnerFields options={options} step={2} />
          {!isTrailer && (
            <>
              <DriverFields options={options} step={3} />
              <DocumentFields options={options} step={4} />
              <MaintenanceFields options={options} step={5} />
              <Section
                title="Datos técnicos"
                step={6}
                optional
                hint="Motor, chasis, cilindraje, capacidad y demás características."
              >
                <TechnicalFields values={EMPTY_TECHNICAL_DATA} />
              </Section>
            </>
          )}
        </ActionForm>
      </SlideOver>
    </>
  );
}

/**
 * Edits the vehicle's own data and its technical sheet in one save; moves to the new URL when
 * the plate changes. The technical sheet is saved first, under the plate it still has.
 */
export function EditVehicleForm({
  values,
  technical,
  options,
  onDone,
  onCancel,
}: {
  values: VehicleEditValues;
  technical: VehicleTechnicalData;
  options: VehicleFormOptions;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  // An existing trailer keeps its class; any other vehicle can still be switched to Remolque here.
  const lockClass = options.classes.find((c) => c.id === values.classId)?.isTrailer ?? false;
  const [classId, setClassId] = useState<number | null>(values.classId);
  const isTrailer = lockClass || (options.classes.find((c) => c.id === classId)?.isTrailer ?? false);
  return (
    <ActionForm
      action={async (fd) => {
        if (!isTrailer) {
          const tech = await updateTechnicalDataAction(values.plate, fd);
          if (!tech.ok) return tech;
        }
        const result = await sendVehicle(
          `/api/vehiculos/${encodeURIComponent(values.plate)}`,
          "PATCH",
          editBodyFromForm(formValues(fd)),
        );
        if (result.ok) {
          // The PATCH only expired the server cache; this clears the browser's copy of the fleet screens.
          await expireVehicleViewsAction().catch(() => undefined);
          if (result.plate && result.plate !== values.plate) {
            router.replace(`/flota/${encodeURIComponent(result.plate)}`);
          } else {
            router.refresh();
          }
        }
        return result;
      }}
      submitLabel="Guardar cambios"
      onDone={onDone}
      onCancel={onCancel}
    >
      <VehicleDataFields
        options={options}
        values={values}
        idPrefix="ev"
        isTrailer={isTrailer}
        lockClass={lockClass}
        onClassChange={setClassId}
      />
      {!isTrailer && (
        <Section title="Datos técnicos" hint="Motor, chasis, cilindraje, capacidad y demás características.">
          <TechnicalFields values={technical} />
        </Section>
      )}
    </ActionForm>
  );
}

