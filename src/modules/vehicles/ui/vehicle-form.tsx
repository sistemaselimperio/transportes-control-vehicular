"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import type { ActionResult } from "../application/vehicle-actions";
import { createBodyFromForm, editBodyFromForm } from "../application/vehicle-form-body";
import type { VehicleEditValues, VehicleFormOptions } from "../application/vehicle-queries";
import { MunicipalityPicker } from "./municipality-picker";

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

/** Titled block of the form; every block after the first gets a divider. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h3 className="text-base leading-tight font-semibold tracking-tight">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Two columns whose controls line up even when one label wraps. */
function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 items-end gap-3">{children}</div>;
}

/** Plate, class, brand, municipality, service, oil mode, towing and notes: shared by create and edit. */
function VehicleDataFields({
  options,
  values,
  idPrefix,
}: {
  options: VehicleFormOptions;
  values?: VehicleEditValues;
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const towingCandidates = options.plates.filter((p) => p !== values?.plate);
  return (
    <Section title="Vehículo">
      <Row>
        <Field label="Placa" htmlFor={id("plate")}>
          <Input
            id={id("plate")}
            name="plate"
            className={`${FIELD} uppercase`}
            defaultValue={values?.plate}
            autoComplete="off"
            required
          />
        </Field>
        <Field label="Clase" htmlFor={id("class")}>
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
        <Input id={id("brand")} name="brandLine" className={FIELD} defaultValue={values?.brandLine ?? ""} />
      </Field>
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
      <Row>
        <Field label="Aceite por" htmlFor={id("oilmode")}>
          <NativeSelect id={id("oilmode")} name="oilMode" className={SELECT} defaultValue={values?.oilMode ?? "both"}>
            {Object.entries(OIL_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
      <Field label="Notas" htmlFor={id("notes")}>
        <Textarea id={id("notes")} name="notes" rows={2} defaultValue={values?.notes ?? ""} />
      </Field>
    </Section>
  );
}

function OwnerFields({ options }: { options: VehicleFormOptions }) {
  const [choice, setChoice] = useState("");
  return (
    <Section title="Propietario" hint="Opcional. Puedes asignarlo después con Traspasar.">
      <div>
        <NativeSelect
          id="nv-owner"
          name="ownerChoice"
          aria-label="Propietario"
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
      </div>
      {choice === "NEW" && (
        <Row>
          <Field label="Nombre" htmlFor="nv-owner-name">
            <Input id="nv-owner-name" name="ownerName" className={FIELD} autoComplete="off" required />
          </Field>
          <Field label="Documento" htmlFor="nv-owner-doc">
            <Input id="nv-owner-doc" name="ownerDocument" inputMode="numeric" className={FIELD} />
          </Field>
        </Row>
      )}
      {choice !== "" && (
        <Field label="Propietario desde" htmlFor="nv-owner-date">
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

function DriverFields({ options }: { options: VehicleFormOptions }) {
  const [choice, setChoice] = useState("");
  return (
    <Section title="Conductor" hint="Opcional. Puedes asignarlo después.">
      <div>
        <NativeSelect
          id="nv-driver"
          name="driverChoice"
          aria-label="Conductor"
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
      </div>
      {choice === "NEW" && (
        <>
          <Field label="Nombre completo" htmlFor="nv-driver-name">
            <Input id="nv-driver-name" name="driverName" className={FIELD} autoComplete="off" required />
          </Field>
          <Row>
            <Field label="Cédula" htmlFor="nv-driver-id">
              <Input id="nv-driver-id" name="driverNationalId" inputMode="numeric" className={FIELD} />
            </Field>
            <Field label="Celular" htmlFor="nv-driver-phone">
              <Input id="nv-driver-phone" name="driverPhone" type="tel" className={FIELD} />
            </Field>
          </Row>
        </>
      )}
      {choice !== "" && (
        <Field label="Maneja desde" htmlFor="nv-driver-date">
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
    <div className="space-y-1">
      <Field label={`${label} vence`} htmlFor={`nv-${prefix}`}>
        <Input
          id={`nv-${prefix}`}
          name={`${prefix}ExpiresOn`}
          type="date"
          className={FIELD}
          disabled={notApplicable}
        />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={`${prefix}NotApplicable`}
          className="size-5"
          checked={notApplicable}
          onChange={(e) => setNotApplicable(e.target.checked)}
        />
        No aplica
      </label>
    </div>
  );
}

function DocumentFields({ options }: { options: VehicleFormOptions }) {
  const [taxKind, setTaxKind] = useState("");
  return (
    <Section title="Documentos e impuesto" hint="Deja en blanco lo que no tengas a mano.">
      <Row>
        <DocumentDateField prefix="soat" label="SOAT" />
        <DocumentDateField prefix="tecno" label="Tecnomecánica" />
      </Row>
      <Row>
        <Field label="Póliza" htmlFor="nv-policy-kind">
          <NativeSelect id="nv-policy-kind" name="policyKind" className={SELECT} defaultValue="TR">
            <option value="TR">Todo riesgo</option>
            <option value="RC">Responsabilidad civil</option>
          </NativeSelect>
        </Field>
        <Field label="Póliza vence" htmlFor="nv-policy-date">
          <Input id="nv-policy-date" name="policyExpiresOn" type="date" className={FIELD} />
        </Field>
      </Row>
      <Row>
        <Field label="Impuesto" htmlFor="nv-tax">
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
          <Field label="Año pagado" htmlFor="nv-tax-year">
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

function MaintenanceFields({ options }: { options: VehicleFormOptions }) {
  const [broken, setBroken] = useState(false);
  return (
    <Section title="Estado y mantenimiento">
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
        <Field label="Kilometraje actual" htmlFor="nv-km">
          <Input id="nv-km" name="currentKm" inputMode="numeric" className={FIELD} disabled={broken} />
        </Field>
      </Row>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="odometerBroken"
          className="size-5"
          checked={broken}
          onChange={(e) => setBroken(e.target.checked)}
        />
        El odómetro no funciona
      </label>
      <Row>
        <Field label="Último cambio de aceite" htmlFor="nv-oil-date">
          <Input id="nv-oil-date" name="oilDate" type="date" className={FIELD} max={options.today} />
        </Field>
        <Field label="Km del cambio" htmlFor="nv-oil-km">
          <Input id="nv-oil-km" name="oilKm" inputMode="numeric" className={FIELD} disabled={broken} />
        </Field>
      </Row>
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
          <VehicleDataFields options={options} idPrefix="nv" />
          <OwnerFields options={options} />
          <DriverFields options={options} />
          <DocumentFields options={options} />
          <MaintenanceFields options={options} />
        </ActionForm>
      </SlideOver>
    </>
  );
}

/** Edits the vehicle's own data; moves to the new URL when the plate changes. */
export function EditVehicleForm({
  values,
  options,
  onDone,
  onCancel,
}: {
  values: VehicleEditValues;
  options: VehicleFormOptions;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (fd) => {
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
      <p className="text-sm text-muted-foreground">
        Propietario, conductor, documentos, kilometraje y estado se cambian con sus propias acciones
        para conservar el historial.
      </p>
      <VehicleDataFields options={options} values={values} idPrefix="ev" />
    </ActionForm>
  );
}

