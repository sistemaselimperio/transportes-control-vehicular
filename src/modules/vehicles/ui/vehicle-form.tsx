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
import { updateTechnicalDataAction, type ActionResult } from "../application/vehicle-actions";
import { createBodyFromForm, editBodyFromForm } from "../application/vehicle-form-body";
import type { VehicleEditValues, VehicleFormOptions } from "../application/vehicle-queries";
import type { VehicleTechnicalData } from "../domain/technical-data";
import { MunicipalityPicker } from "./municipality-picker";
import { TechnicalFields } from "./vehicle-action-forms";

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

/** Plate, class, brand, municipality, service, oil mode, towing and notes: shared by create and edit. */
function VehicleDataFields({
  options,
  values,
  idPrefix,
  step,
}: {
  options: VehicleFormOptions;
  values?: VehicleEditValues;
  idPrefix: string;
  step?: number;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const towingCandidates = options.plates.filter((p) => p !== values?.plate);
  return (
    <Section title="Vehículo" step={step}>
      <Group label="Identificación">
        <Row>
          <Field label="Placa" htmlFor={id("plate")} required>
            <Input
              id={id("plate")}
              name="plate"
              className={`${FIELD} num uppercase`}
              defaultValue={values?.plate}
              placeholder="ABC123"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </Field>
          <Field label="Clase" htmlFor={id("class")} required>
            <NativeSelect id={id("class")} name="classId" className={SELECT} defaultValue={values?.classId ?? ""} required>
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
        </Row>
        <Field label="Marca y línea" htmlFor={id("brand")}>
          <Input
            id={id("brand")}
            name="brandLine"
            className={FIELD}
            placeholder="Ej. Kenworth T800"
            defaultValue={values?.brandLine ?? ""}
          />
        </Field>
      </Group>

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
          <Field label="Remolcado por" htmlFor={id("towing")}>
            <NativeSelect
              id={id("towing")}
              name="towingPlate"
              className={SELECT}
              defaultValue={values?.towingPlate ?? ""}
            >
              <option value="">No es remolque</option>
              {towingCandidates.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </Row>
      </Group>

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
          <DocumentDateField prefix="tecno" label="Tecnomecánica" />
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
          <Field label="Kilometraje actual" htmlFor="nv-km" hint={broken ? "Sin odómetro." : "En km."}>
            <Input id="nv-km" name="currentKm" inputMode="numeric" className={`${FIELD} num`} disabled={broken} />
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
          <Field label="Kilometraje" htmlFor="nv-oil-km">
            <Input id="nv-oil-km" name="oilKm" inputMode="numeric" className={`${FIELD} num`} disabled={broken} />
          </Field>
        </Row>
      </Group>
    </Section>
  );
}

/** "Nuevo vehículo" button with the full create form; opens the new vehicle's file when saved. */
export function NewVehicleButton({ options }: { options: VehicleFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-11 px-4 md:h-10" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nuevo vehículo
      </Button>
      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title="Nuevo vehículo"
        description="Solo placa y clase son obligatorias."
        wide
      >
        <ActionForm
          action={async (fd) => {
            const result = await sendVehicle("/api/vehiculos", "POST", createBodyFromForm(formValues(fd)));
            if (result.ok && result.plate) router.push(`/flota/${encodeURIComponent(result.plate)}`);
            return result;
          }}
          submitLabel="Crear vehículo"
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          <VehicleDataFields options={options} idPrefix="nv" step={1} />
          <OwnerFields options={options} step={2} />
          <DriverFields options={options} step={3} />
          <DocumentFields options={options} step={4} />
          <MaintenanceFields options={options} step={5} />
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
  return (
    <ActionForm
      action={async (fd) => {
        const tech = await updateTechnicalDataAction(values.plate, fd);
        if (!tech.ok) return tech;
        const result = await sendVehicle(
          `/api/vehiculos/${encodeURIComponent(values.plate)}`,
          "PATCH",
          editBodyFromForm(formValues(fd)),
        );
        if (result.ok) {
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
      <VehicleDataFields options={options} values={values} idPrefix="ev" />
      <Section title="Datos técnicos" hint="Motor, chasis, cilindraje, capacidad y demás características.">
        <TechnicalFields values={technical} />
      </Section>
    </ActionForm>
  );
}

