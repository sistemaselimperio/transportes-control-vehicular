"use client";

import { AlertCircle, Paperclip, Sparkles } from "lucide-react";
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { optimizeFile } from "@/modules/documents/ui/optimize-file";
import { formatPesos } from "@/modules/vehicles/ui/vehicle-people-forms";
import { createExpenseAction, updateExpenseAction } from "../application/petty-cash-actions";
import { RESPONSIBILITY_LABELS, RESPONSIBILITY_TYPES, type ResponsibilityType } from "../domain/expense";
import { formatNit, normalizeNit } from "../domain/nit";
import type { ExpenseRow, OwnerOption, SupplierRow, VehicleOption } from "../domain/petty-cash-rows";
import { AttachmentViewer } from "./attachment-viewer";

const FIELD = "h-11 md:h-10";

/** Required fields checked in the browser, so the message sits next to the field instead of at the bottom. */
const REQUIRED_MESSAGES = {
  detail: "Escribe qué se compró.",
  value: "Escribe el valor del gasto.",
  nit: "Escribe el NIT del proveedor.",
  vehicle: "Elige el vehículo o escribe el destino.",
} as const;
type RequiredField = keyof typeof REQUIRED_MESSAGES;
const REQUIRED_ORDER: readonly RequiredField[] = ["detail", "value", "nit", "vehicle"];
const FIELD_IDS: Record<RequiredField, string> = {
  detail: "expense-detail",
  value: "expense-value",
  nit: "expense-nit",
  vehicle: "expense-vehicle",
};
/** Dropdown value for a destination that is not a fleet vehicle (a plant, a yard...); typed by hand. */
const OTHER_DESTINATION = "__other__";

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-3.5">
      <h3 id={id} className="micro-label border-b pb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Labelled control with helper text and an inline error; the control links to them with `aria-describedby`. */
function FormField({
  label,
  id,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  id: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="gap-1 text-sm text-foreground">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describe = (id: string, error?: string, hint?: ReactNode) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error || hint ? `${id}-msg` : undefined,
});

/** Peso amount with a "$" prefix, live thousands separators and a numeric keyboard; the server action reads the digits. */
function PesosField({
  defaultValue,
  error,
  onEdit,
}: {
  defaultValue?: number | null;
  error?: string;
  onEdit: () => void;
}) {
  const [value, setValue] = useState(defaultValue == null ? "" : formatPesos(String(defaultValue)));
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        $
      </span>
      <Input
        id="expense-value"
        name="value"
        inputMode="numeric"
        autoComplete="off"
        className={`num pl-7 ${FIELD}`}
        value={value}
        onChange={(e) => {
          setValue(formatPesos(e.target.value));
          onEdit();
        }}
        {...describe("expense-value", error)}
      />
    </div>
  );
}

/** Creates an expense of `ledgerId`, or edits `expense` when given. */
export function ExpenseForm({
  ledgerId,
  expense,
  suppliers,
  vehicles,
  owners,
  submitLabel,
  cancelLabel = "Cancelar",
  extraAction,
  onDone,
  onCancel,
}: {
  ledgerId: number;
  expense?: ExpenseRow;
  suppliers: readonly SupplierRow[];
  vehicles: readonly VehicleOption[];
  owners: readonly OwnerOption[];
  /** Replaces the default button text (the review flow says "Guardar y siguiente"). */
  submitLabel?: string;
  cancelLabel?: string;
  /** Another secondary button next to cancel (the review flow's "Saltar"). */
  extraAction?: ReactNode;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const byNit = useMemo(() => new Map(suppliers.map((s) => [s.nit, s])), [suppliers]);
  const [nit, setNit] = useState(expense?.nit ?? "");
  const [supplierName, setSupplierName] = useState(expense?.supplierName ?? "");
  const [responsibility, setResponsibility] = useState<ResponsibilityType | "">(expense?.responsibilityType ?? "");
  const [fromCatalog, setFromCatalog] = useState(false);
  const [viewing, setViewing] = useState(false);
  // The fleet, grouped by class for the dropdown; a label that is not a fleet plate is an "other" destination.
  const vehicleGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const v of vehicles) groups.set(v.className, [...(groups.get(v.className) ?? []), v.plate]);
    return [...groups.entries()];
  }, [vehicles]);
  const savedVehicle = expense?.vehicleLabel ?? "";
  const savedIsFleet = vehicles.some((v) => v.plate === savedVehicle);
  const otherDestination = savedVehicle && !savedIsFleet ? savedVehicle : "";
  const [vehicleChoice, setVehicleChoice] = useState(
    savedIsFleet ? savedVehicle : otherDestination ? OTHER_DESTINATION : "",
  );
  // Older expenses may carry a company typed by hand or read by the AI: only an existing one is preselected.
  const knownCompany = owners.find((o) => o.name === expense?.company)?.name ?? null;
  const unknownCompany = expense?.company && !knownCompany ? expense.company : null;
  const [errors, setErrors] = useState<Partial<Record<RequiredField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeNit(raw: string) {
    const digits = normalizeNit(raw).slice(0, 15);
    setNit(digits);
    clearError("nit");
    const supplier = byNit.get(digits);
    // A known NIT only completes the supplier's name and responsibility; the billed company is never guessed from it.
    let filled = false;
    if (supplier?.responsibilityType) {
      setResponsibility(supplier.responsibilityType);
      filled = true;
    }
    if (supplier?.supplierName && supplierName.trim() === "") {
      setSupplierName(supplier.supplierName);
      filled = true;
    }
    setFromCatalog(filled);
  }

  function clearError(field: RequiredField) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const filled: Record<RequiredField, boolean> = {
      detail: String(fd.get("detail") ?? "").trim() !== "",
      value: String(fd.get("value") ?? "").replace(/\D/g, "") !== "",
      nit: nit !== "",
      vehicle: String(fd.get("vehicle") ?? "").trim() !== "",
    };
    const missing = REQUIRED_ORDER.filter((f) => !filled[f]);
    setErrors(Object.fromEntries(missing.map((f) => [f, REQUIRED_MESSAGES[f]])));
    if (missing.length > 0) {
      setServerError(null);
      form.querySelector<HTMLElement>(`#${FIELD_IDS[missing[0]]}`)?.focus();
      return;
    }
    setServerError(null);
    startTransition(async () => {
      // Photos are shrunk in the browser first: the server caps a file at 4 MB.
      const file = fd.get("file");
      if (file instanceof File && file.size > 0) fd.set("file", await optimizeFile(file));
      const result = await (expense ? updateExpenseAction(expense.id, fd) : createExpenseAction(ledgerId, fd));
      if (result.ok) onDone(result.message);
      else setServerError(result.error);
    });
  }

  return (
    <form
      data-slot="action-form"
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
        <Group title="¿Qué se compró?">
          <FormField label="Detalle" id="expense-detail" required error={errors.detail}>
            <Input
              id="expense-detail"
              name="detail"
              className={FIELD}
              defaultValue={expense?.detail}
              maxLength={200}
              autoComplete="off"
              autoFocus={!expense}
              onChange={() => clearError("detail")}
              {...describe("expense-detail", errors.detail)}
            />
          </FormField>
          <FormField label="Valor" id="expense-value" required error={errors.value}>
            <PesosField
              defaultValue={expense?.value}
              error={errors.value}
              onEdit={() => clearError("value")}
            />
          </FormField>
        </Group>

        <Group title="Proveedor">
          <FormField
            label="NIT del proveedor"
            id="expense-nit"
            required
            error={errors.nit}
            hint="Solo el número, sin el dígito de verificación (lo que va después del guion)."
          >
            <Input
              id="expense-nit"
              name="nit"
              inputMode="numeric"
              autoComplete="off"
              className={`num ${FIELD}`}
              value={formatNit(nit)}
              onChange={(e) => changeNit(e.target.value)}
              {...describe("expense-nit", errors.nit, true)}
            />
          </FormField>
          <FormField label="Nombre del proveedor" id="expense-supplier" hint="Quien emite la factura.">
            <Input
              id="expense-supplier"
              name="supplierName"
              className={FIELD}
              value={supplierName}
              onChange={(e) => {
                setSupplierName(e.target.value);
                setFromCatalog(false);
              }}
              maxLength={150}
              autoComplete="off"
              aria-describedby="expense-supplier-msg"
            />
          </FormField>
          <FormField
            label="Tipo de responsabilidad"
            id="expense-responsibility"
            hint={
              fromCatalog ? (
                <span className="inline-flex items-center gap-1 font-medium text-ok-foreground">
                  <Sparkles className="size-3.5" aria-hidden />
                  Se completó desde el catálogo de proveedores.
                </span>
              ) : undefined
            }
          >
            <NativeSelect
              id="expense-responsibility"
              name="responsibilityType"
              className="h-11 md:h-10"
              value={responsibility}
              onChange={(e) => {
                setResponsibility(e.target.value as ResponsibilityType | "");
                setFromCatalog(false);
              }}
              aria-describedby={fromCatalog ? "expense-responsibility-msg" : undefined}
            >
              <option value="">Sin definir</option>
              {RESPONSIBILITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RESPONSIBILITY_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </Group>

        <Group title="¿A nombre de quién?">
          <FormField
            label="Empresa"
            id="expense-company"
            hint={
              unknownCompany
                ? `«${unknownCompany}» no es una de las empresas registradas. Elige la correcta.`
                : "A quién se le factura. Solo las empresas registradas."
            }
          >
            <NativeSelect
              id="expense-company"
              name="company"
              className="h-11 md:h-10"
              defaultValue={knownCompany ?? ""}
              aria-describedby="expense-company-msg"
            >
              <option value="">Sin definir</option>
              {owners.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </Group>

        <Group title="Vehículo">
          <FormField
            label="Placa o destino"
            id="expense-vehicle"
            required
            error={errors.vehicle}
            hint="Elige la placa de la lista. Si el gasto no es de un vehículo, elige «Otro destino»."
          >
            <NativeSelect
              id="expense-vehicle"
              className="h-11 md:h-10"
              value={vehicleChoice}
              onChange={(e) => {
                setVehicleChoice(e.target.value);
                clearError("vehicle");
              }}
              {...describe("expense-vehicle", errors.vehicle, true)}
            >
              <option value="">Elige una placa…</option>
              {vehicleGroups.map(([className, plates]) => (
                <optgroup key={className} label={className}>
                  {plates.map((plate) => (
                    <option key={plate} value={plate}>
                      {plate}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={OTHER_DESTINATION}>Otro destino (escribir)…</option>
            </NativeSelect>
            {vehicleChoice === OTHER_DESTINATION ? (
              <Input
                id="expense-vehicle-other"
                name="vehicle"
                aria-label="Otro destino"
                placeholder="Por ejemplo, PLANTA F. MIRAMAR"
                className={`${FIELD} mt-2`}
                defaultValue={otherDestination}
                maxLength={80}
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus={otherDestination === ""}
                onChange={() => clearError("vehicle")}
              />
            ) : (
              <input type="hidden" name="vehicle" value={vehicleChoice} />
            )}
          </FormField>
        </Group>

        <Group title="Factura">
          <FormField label="Nº de factura" id="expense-invoice">
            <Input
              id="expense-invoice"
              name="invoiceNumber"
              className={FIELD}
              defaultValue={expense?.invoiceNumber ?? ""}
              maxLength={60}
              autoComplete="off"
            />
          </FormField>
          <FormField label="EFK" id="expense-efk" hint="Código o referencia (opcional)">
            <Input
              id="expense-efk"
              name="efk"
              className={FIELD}
              defaultValue={expense?.efk ?? ""}
              maxLength={50}
              autoComplete="off"
            />
          </FormField>
          <FormField label="Adjunto (foto o PDF)" id="expense-file" hint="Opcional. PDF, JPG, PNG o WebP.">
            <Input
              id="expense-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="h-auto py-2.5 md:py-2"
              aria-describedby="expense-file-msg"
            />
          </FormField>
          {expense?.attachment && (
            <div className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <button
                  type="button"
                  onClick={() => setViewing(true)}
                  className="min-h-11 min-w-0 truncate text-left underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {expense.attachment.name}
                </button>
                <AttachmentViewer
                  attachment={viewing ? { expenseId: expense.id, ...expense.attachment } : null}
                  onClose={() => setViewing(false)}
                />
              </p>
              <label className="flex min-h-11 items-start gap-2">
                <input type="checkbox" name="removeAttachment" className="mt-0.5 size-5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Eliminar el adjunto actual</span>
                  <span className="block text-xs text-muted-foreground">
                    Para cambiarlo por otro, solo elige el archivo nuevo arriba.
                  </span>
                </span>
              </label>
            </div>
          )}
        </Group>
      </div>

      {/* Action bar outside the scroll area, so Save is always in view; its error too. */}
      <div className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {serverError && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">
            {serverError}
          </p>
        )}
        {Object.values(errors).some(Boolean) && (
          <p role="alert" className="text-sm font-medium text-destructive">
            Faltan datos obligatorios: revisa los campos marcados.
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <div className="flex gap-2 max-sm:[&>*]:flex-1">
            <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={pending}>
              {cancelLabel}
            </Button>
            {extraAction}
          </div>
          <Button type="submit" className="h-12 px-5 sm:h-11 md:h-10" disabled={pending}>
            {pending ? "Guardando…" : (submitLabel ?? (expense ? "Guardar cambios" : "Registrar gasto"))}
          </Button>
        </div>
      </div>
    </form>
  );
}
