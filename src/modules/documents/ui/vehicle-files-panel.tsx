"use client";

import { Popover } from "@base-ui/react/popover";
import { CircleCheck, FileText, Loader2, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { VehicleFileItem } from "../application/vehicle-file-ports";
import {
  deleteVehicleFileAction,
  uploadVehicleFileAction,
} from "../application/vehicle-file-actions";
import { FILE_GROUPS, fileKindLabel } from "../domain/vehicle-file-groups";
import {
  ALLOWED_MIME,
  FILE_CATEGORIES,
  formatFileSize,
  type FileCategory,
} from "../domain/vehicle-file-rules";
import { optimizeFile } from "./optimize-file";

const ACCEPT = ALLOWED_MIME.join(",");

type Stage = { category: FileCategory; step: "optimizing" | "uploading" };

const CATEGORIES = FILE_GROUPS.flatMap((g) => g.categories);

/**
 * Card order and width on a six-column grid: SOAT, póliza and impuestos share the top row; the
 * other categories split the row below. Any category not listed here falls in after them.
 */
const TOP_ROW: readonly FileCategory[] = ["SOAT", "POLICY", "TAX"];
const LAYOUT: Array<{ category: FileCategory; span: string }> = [
  ...TOP_ROW.map((category) => ({ category, span: "col-span-2" })),
  ...CATEGORIES.filter((c) => !TOP_ROW.includes(c)).map((category) => ({ category, span: "col-span-3" })),
];

const uploadedOn = (at: Date) =>
  formatDisplayDate(new Date(at).toISOString().slice(0, 10));

/**
 * The vehicle's paper folder, compact: one line per document with its count, a "Ver" that opens
 * its files in a popover, and an upload button. Expiry lives in the header cards. Upload is
 * optimized in the browser first.
 */
export function VehicleFilesPanel({
  plate,
  files,
  readOnly = false,
}: {
  plate: string;
  files: VehicleFileItem[];
  readOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage | null>(null);
  /** File id being deleted (spinner) and file id waiting for its inline confirmation. */
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [done, setDone] = useState<FileCategory | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FileCategory, string>>>(
    {},
  );
  const inputs = useRef<Partial<Record<FileCategory, HTMLInputElement | null>>>(
    {},
  );

  const setError = (category: FileCategory, error: string | null) =>
    setErrors((prev) => ({ ...prev, [category]: error ?? undefined }));

  function upload(category: FileCategory, picked: File) {
    setError(category, null);
    setDone(null);
    setConfirming(null);
    setStage({ category, step: "optimizing" });
    startTransition(async () => {
      try {
        const file = await optimizeFile(picked);
        setStage({ category, step: "uploading" });
        const fd = new FormData();
        fd.set("category", category);
        fd.set("file", file);
        const result = await uploadVehicleFileAction(plate, fd);
        if (!result.ok) setError(category, result.error);
        else {
          setDone(category);
          setTimeout(() => setDone((d) => (d === category ? null : d)), 4000);
        }
      } catch {
        setError(category, "No se pudo subir el archivo. Intenta de nuevo.");
      } finally {
        setStage(null);
        const input = inputs.current[category];
        if (input) input.value = "";
      }
    });
  }

  function remove(category: FileCategory, file: VehicleFileItem) {
    setConfirming(null);
    setError(category, null);
    setDone(null);
    setDeleting(file.id);
    startTransition(async () => {
      try {
        const result = await deleteVehicleFileAction(plate, file.id);
        if (!result.ok) setError(category, result.error);
      } catch {
        setError(category, "No se pudo eliminar el archivo. Intenta de nuevo.");
      } finally {
        setDeleting(null);
      }
    });
  }

  function renderFile(category: FileCategory, f: VehicleFileItem) {
    if (confirming === f.id) {
      return (
        <li
          key={f.id}
          role="group"
          aria-label={`Confirmar eliminar ${f.fileName}`}
          className="flex min-h-11 items-center gap-1 rounded-lg bg-destructive/10 px-2 md:min-h-9"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-destructive">
            ¿Eliminar {f.fileName}?
          </span>
          <Button
            type="button"
            variant="destructive"
            className="h-11 px-2.5 md:h-7"
            disabled={pending}
            onClick={() => remove(category, f)}
          >
            Sí
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-2.5 md:h-7"
            onClick={() => setConfirming(null)}
          >
            No
          </Button>
        </li>
      );
    }
    return (
      <li
        key={f.id}
        className="flex items-center gap-1 rounded-lg hover:bg-muted/60"
      >
        <a
          href={`/api/vehiculos/${encodeURIComponent(plate)}/archivos/${f.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 md:min-h-9"
        >
          <FileText
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{f.fileName}</span>
            <span className="num block text-xs text-muted-foreground">
              {fileKindLabel(f.fileName)} · {formatFileSize(f.sizeBytes)} ·{" "}
              {uploadedOn(f.uploadedAt)}
            </span>
          </span>
        </a>
        {!readOnly && (
          <button
            type="button"
            aria-label={`Eliminar ${f.fileName}`}
            title="Eliminar"
            disabled={pending}
            onClick={() => setConfirming(f.id)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-50 md:size-8"
          >
            {deleting === f.id ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <X className="size-4" aria-hidden />
            )}
          </button>
        )}
      </li>
    );
  }

  function renderDoc({ category, span }: { category: FileCategory; span: string }) {
    const { label, limit } = FILE_CATEGORIES[category];
    const list = files.filter((f) => f.category === category);
    const full = list.length >= limit;
    const error = errors[category];
    const working = stage?.category === category ? stage.step : null;

    return (
      <li
        key={category}
        className={`${span} flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-card py-1.5 pr-1.5 pl-3`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm leading-tight font-semibold">{label}</h3>
          <span className="num shrink-0 text-xs text-muted-foreground">
            {list.length}/{limit}
          </span>
        </div>

        {working ? (
          <span role="status" className="flex items-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span className="sr-only">{working === "optimizing" ? "Optimizando…" : "Subiendo…"}</span>
          </span>
        ) : done === category ? (
          <span role="status" className="flex items-center text-ok-foreground">
            <CircleCheck className="size-4" aria-hidden />
            <span className="sr-only">Subido</span>
          </span>
        ) : null}

        {list.length > 0 ? (
          <Popover.Root
            onOpenChange={(open) => {
              if (!open) setConfirming(null);
            }}
          >
            <Popover.Trigger className="inline-flex h-11 items-center rounded-md px-2.5 text-sm font-medium outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted md:h-8">
              Ver
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner align="end" sideOffset={6} className="z-50">
                <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-1 shadow-soft outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                  <Popover.Title className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
                    {label} · {list.length}{" "}
                    {list.length === 1 ? "archivo" : "archivos"}
                  </Popover.Title>
                  <ul>{list.map((f) => renderFile(category, f))}</ul>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        ) : null}

        {!readOnly && (
          <>
            <input
              ref={(el) => {
                inputs.current[category] = el;
              }}
              type="file"
              accept={ACCEPT}
              className="hidden"
              tabIndex={-1}
              aria-hidden
              disabled={full || pending}
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) upload(category, picked);
              }}
            />
            <button
              type="button"
              aria-label={
                full ? `${label}: carpeta llena` : `Subir archivo de ${label}`
              }
              title={
                full
                  ? "Carpeta llena: elimina un archivo para subir otro"
                  : "Subir archivo"
              }
              disabled={full || pending}
              onClick={() => inputs.current[category]?.click()}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 md:size-8"
            >
              <Upload className="size-4" aria-hidden />
            </button>
          </>
        )}

        {error && (
          <p
            role="alert"
            className="basis-full pb-0.5 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <div className="@container mt-3 min-w-0">
      <ul className="grid grid-cols-6 gap-2">
        {LAYOUT.map(renderDoc)}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        PDF, JPG, PNG o WebP · máx. 4 MB por archivo
      </p>
    </div>
  );
}
