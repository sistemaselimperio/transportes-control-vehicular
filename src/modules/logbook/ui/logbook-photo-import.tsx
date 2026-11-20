"use client";

import { AlertCircle, Camera, FileUp, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { optimizeFile } from "@/modules/documents/ui/optimize-file";
import { formatPesos } from "@/modules/vehicles/ui/vehicle-people-forms";
import { readServicesFromPhotoAction, saveServicesFromPhotoAction } from "../application/logbook-photo-actions";
import type { ServiceDraft } from "../application/service-photo-import";
import { SERVICE_KIND_LABELS } from "../domain/logbook";
import { FIELD } from "./logbook-forms";

/** Same limit as the server (`service-photo-import.ts`), checked first to answer before uploading. */
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** A draft in the review list, with a stable key and the reason its last save failed. */
interface Row extends ServiceDraft {
  key: number;
  error?: string;
}

/** What is missing before the row can be saved; empty when it is complete. */
function missingFields(row: ServiceDraft, today: string): string[] {
  const missing: string[] = [];
  if (!row.plate) missing.push("vehículo");
  if (!row.date) missing.push("fecha");
  else if (row.date > today) missing.push("fecha (no puede ser futura)");
  if (!row.description.trim()) missing.push("descripción");
  return missing;
}

/** The text values each input holds, as the single-record form would submit them. */
const toFormValues = ({ plate, date, kind, description, provider, km, price, notes }: ServiceDraft) => ({
  plate,
  date,
  kind,
  description,
  provider,
  km,
  price,
  notes,
});

/**
 * Registers many maintenance records from a photo (or PDF) of a log: the AI reads one record per
 * row, the person reviews and fixes them, and all are saved with the same rules as the single form.
 */
export function LogbookPhotoImportFlow({
  today,
  plates,
  providers,
  defaultPlate,
  onDone,
  onCancel,
}: {
  today: string;
  plates: readonly string[];
  providers: readonly string[];
  /** The vehicle chosen on the page, for rows that state none. */
  defaultPlate: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setFileName(file.name);
    startReading(async () => {
      try {
        // Photos are shrunk in the browser: a phone photo is bigger than a server-action body may be.
        const ready = await optimizeFile(file, { keepDigitalPdf: true });
        if (ready.size > MAX_BYTES) return setError("El archivo supera el límite de 4 MB. Toma la foto más cerca o en dos partes.");
        const fd = new FormData();
        fd.set("file", ready);
        fd.set("plate", defaultPlate);
        const result = await readServicesFromPhotoAction(fd);
        if (!result.ok) return setError(result.error);
        if (result.rows.length === 0) return setError("No se encontraron mantenimientos en el archivo. Prueba con una foto más nítida.");
        setRows(result.rows.map((r) => ({ ...r, key: nextKey.current++ })));
      } catch (err) {
        console.error("logbook photo read failed", err);
        setError("No se pudo leer el archivo. Revisa que no esté dañado e intenta de nuevo.");
      }
    });
  }

  const update = (key: number, patch: Partial<ServiceDraft>) =>
    setRows((current) => current?.map((r) => (r.key === key ? { ...r, ...patch, error: undefined } : r)) ?? null);
  const remove = (key: number) => setRows((current) => current?.filter((r) => r.key !== key) ?? null);

  const incomplete = rows?.filter((r) => missingFields(r, today).length > 0).length ?? 0;

  function save() {
    if (!rows || rows.length === 0) return;
    setError(null);
    const sent = rows;
    startSaving(async () => {
      const result = await saveServicesFromPhotoAction(sent.map(toFormValues));
      if (!result.ok) return setError(result.error);
      if (result.errors.length === 0) return onDone(result.message);
      // Keep only the rows that failed, each with its reason; the saved ones are already in the logbook.
      const reasons = new Map(result.errors.map((e) => [e.index, e.error]));
      setRows(sent.flatMap((r, i) => (reasons.has(i) ? [{ ...r, error: reasons.get(i) }] : [])));
      setError(`${result.message} Revisa las filas con error y vuelve a guardar.`);
    });
  }

  const busy = reading || saving;

  return (
    <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={pick}
        />
        <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" tabIndex={-1} aria-hidden onChange={pick} />

        {!rows && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Toma una foto de la bitácora o de una lista de mantenimientos (o sube un PDF). La IA lee una fila por
              mantenimiento y tú revisas todo antes de guardar.
              {defaultPlate && ` Las filas sin vehículo se asignan a ${defaultPlate}.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="h-11 px-4 md:h-10" disabled={busy} onClick={() => cameraInput.current?.click()}>
                <Camera aria-hidden />
                Tomar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 md:h-10"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <FileUp aria-hidden />
                Elegir foto o PDF
              </Button>
            </div>
            {reading && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Leyendo {fileName ?? "el archivo"} con IA… puede tardar hasta un minuto.
              </p>
            )}
          </div>
        )}

        {rows && (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              {rows.length === 1 ? "Se leyó 1 mantenimiento." : `Se leyeron ${rows.length} mantenimientos.`} Revisa cada
              fila: lo que la IA no pudo leer quedó vacío.
            </p>
            <ul className="space-y-3">
              {rows.map((row, index) => (
                <ReviewRow
                  key={row.key}
                  index={index}
                  row={row}
                  today={today}
                  plates={plates}
                  providers={providers}
                  disabled={saving}
                  onChange={(patch) => update(row.key, patch)}
                  onRemove={() => remove(row.key)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {rows && incomplete > 0 && (
          <p className="text-xs text-muted-foreground">
            {incomplete === 1 ? "Falta completar 1 fila" : `Faltan por completar ${incomplete} filas`} (o quítalas) para guardar.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          {rows && (
            <Button
              type="button"
              className="h-11 px-4 md:h-10"
              onClick={save}
              disabled={busy || rows.length === 0 || incomplete > 0}
            >
              {saving
                ? "Guardando…"
                : rows.length === 1
                  ? "Guardar 1 mantenimiento"
                  : `Guardar ${rows.length} mantenimientos`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  index,
  row,
  today,
  plates,
  providers,
  disabled,
  onChange,
  onRemove,
}: {
  index: number;
  row: Row;
  today: string;
  plates: readonly string[];
  providers: readonly string[];
  disabled: boolean;
  onChange: (patch: Partial<ServiceDraft>) => void;
  onRemove: () => void;
}) {
  const id = `photo-row-${row.key}`;
  const missing = missingFields(row, today);
  const listId = `${id}-providers`;
  return (
    <li className={cn("space-y-3 rounded-xl border bg-card p-3", (row.error || missing.length > 0) && "border-destructive/50")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Fila {index + 1}</h3>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-2 text-muted-foreground hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Quitar la fila ${index + 1}`}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label="Vehículo" htmlFor={`${id}-plate`} required>
          <NativeSelect
            id={`${id}-plate`}
            value={row.plate}
            disabled={disabled}
            aria-invalid={!row.plate}
            onChange={(e) => onChange({ plate: e.target.value })}
          >
            <option value="" disabled>
              Selecciona…
            </option>
            {plates.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Fecha" htmlFor={`${id}-date`} required>
          <Input
            id={`${id}-date`}
            type="date"
            className={FIELD}
            value={row.date}
            max={today}
            disabled={disabled}
            aria-invalid={!row.date || row.date > today}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>
        <Field label="Tipo" htmlFor={`${id}-kind`} required>
          <NativeSelect
            id={`${id}-kind`}
            value={row.kind}
            disabled={disabled}
            onChange={(e) => onChange({ kind: e.target.value as ServiceDraft["kind"] })}
          >
            {Object.entries(SERVICE_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Proveedor" htmlFor={`${id}-provider`}>
          <Input
            id={`${id}-provider`}
            list={listId}
            className={FIELD}
            autoComplete="off"
            maxLength={120}
            value={row.provider}
            disabled={disabled}
            onChange={(e) => onChange({ provider: e.target.value })}
          />
          <datalist id={listId}>
            {providers.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Descripción" htmlFor={`${id}-description`} required>
        <Textarea
          id={`${id}-description`}
          rows={2}
          className="field-sizing-content max-h-60 min-h-16"
          value={row.description}
          disabled={disabled}
          aria-invalid={!row.description.trim()}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label="Precio (opcional)" htmlFor={`${id}-price`}>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`${id}-price`}
              inputMode="numeric"
              autoComplete="off"
              className={cn(FIELD, "num pl-7")}
              value={row.price === "" ? "" : formatPesos(row.price)}
              disabled={disabled}
              onChange={(e) => onChange({ price: formatPesos(e.target.value) })}
            />
          </div>
        </Field>
        <Field label="Kilometraje (opcional)" htmlFor={`${id}-km`}>
          <Input
            id={`${id}-km`}
            inputMode="numeric"
            autoComplete="off"
            className={cn(FIELD, "num")}
            value={row.km === "" ? "" : formatPesos(row.km)}
            disabled={disabled}
            onChange={(e) => onChange({ km: formatPesos(e.target.value) })}
          />
        </Field>
      </div>
      <Field label="Novedad (opcional)" htmlFor={`${id}-notes`}>
        <Input
          id={`${id}-notes`}
          className={FIELD}
          maxLength={500}
          value={row.notes}
          disabled={disabled}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>
      {row.error ? (
        <p role="alert" className="text-sm text-destructive">
          {row.error}
        </p>
      ) : (
        missing.length > 0 && <p className="text-sm text-destructive">Falta: {missing.join(", ")}.</p>
      )}
    </li>
  );
}
