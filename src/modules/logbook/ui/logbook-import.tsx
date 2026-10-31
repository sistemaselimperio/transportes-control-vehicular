"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmLogbookImportAction, previewLogbookImportAction } from "../application/logbook-import-actions";
import { importFileProblem, type ImportPreview } from "../domain/logbook-import";

/** Skipped rows spelled out on screen; the counts above cover all of them. */
const SHOWN_SKIPPED = 15;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function form(plate: string, file: File): FormData {
  const fd = new FormData();
  fd.set("plate", plate);
  fd.set("file", file);
  return fd;
}

/**
 * Imports a vehicle's logbook Excel in two steps: choosing the file shows a
 * preview computed on the server (nothing is written), and confirming imports it.
 */
export function LogbookImportFlow({
  plate,
  onDone,
  onCancel,
}: {
  plate: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [importing, startImporting] = useTransition();
  // Only the latest file's preview counts when the operator changes the file quickly.
  const request = useRef(0);

  function choose(next: File | null) {
    const id = ++request.current;
    setFile(next);
    setPreview(null);
    setError(null);
    if (!next) return;
    const problem = importFileProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    startReading(async () => {
      const result = await previewLogbookImportAction(form(plate, next));
      if (id !== request.current) return;
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    });
  }

  function confirm() {
    if (!file) return;
    setError(null);
    startImporting(async () => {
      const result = await confirmLogbookImportAction(form(plate, file));
      if (result.ok) onDone(result.message);
      else setError(result.error);
    });
  }

  const skippedTotal = preview ? preview.tabs.reduce((sum, t) => sum + t.skipped, 0) + preview.technical.skipped : 0;
  const busy = reading || importing;

  return (
    <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        <Field
          label="Archivo de la bitácora"
          htmlFor="logbook-import-file"
          hint={`Excel (.xlsx) de hasta 4 MB. Debe ser la bitácora de ${plate}; lo que ya está registrado no se duplica.`}
        >
          <Input
            id="logbook-import-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="h-auto py-2"
            disabled={importing}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
        </Field>

        {reading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Leyendo el archivo…
          </p>
        )}

        {preview && (
          <div className="space-y-3" aria-live="polite">
            <h3 className="text-sm font-semibold">Vista previa</h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Bitácora
                    </th>
                    <th scope="col" className="num px-3 py-2 text-right font-medium">
                      Nuevos
                    </th>
                    <th scope="col" className="num px-3 py-2 text-right font-medium">
                      Repetidos
                    </th>
                    <th scope="col" className="num px-3 py-2 text-right font-medium">
                      Omitidos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.tabs.map((t) => (
                    <tr key={t.tab}>
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {t.label}
                      </th>
                      <td className="num px-3 py-2 text-right font-semibold">{t.create}</td>
                      <td className="num px-3 py-2 text-right text-muted-foreground">{t.duplicates}</td>
                      <td className="num px-3 py-2 text-right text-muted-foreground">{t.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.technical.count > 0 && (
              <p className="text-sm">
                <span className="font-medium">
                  Datos técnicos: {plural(preview.technical.count, "campo", "campos")}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({preview.technical.labels.join(", ")}). Solo se llenan los que están vacíos.
                </span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {preview.total === 0
                ? "No hay registros nuevos para importar."
                : `Se crearán ${plural(preview.total, "registro", "registros")}. Los mantenimientos entran como preventivos; edítalos después si alguno fue correctivo.`}
            </p>

            {skippedTotal > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">
                  {plural(skippedTotal, "fila omitida", "filas omitidas")}
                </h3>
                <ul className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                  {preview.skipped.slice(0, SHOWN_SKIPPED).map((s) => (
                    <li key={`${s.tab}-${s.row}-${s.message}`}>
                      <span className="font-medium">
                        {preview.tabs.find((t) => t.tab === s.tab)?.label ?? "Datos generales"}, fila {s.row}:
                      </span>{" "}
                      <span className="text-muted-foreground">{s.message}</span>
                    </li>
                  ))}
                </ul>
                {skippedTotal > SHOWN_SKIPPED && (
                  <p className="text-xs text-muted-foreground">Y {skippedTotal - SHOWN_SKIPPED} más.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={importing}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 px-4 md:h-10"
            onClick={confirm}
            disabled={busy || !preview || preview.total === 0}
          >
            {importing ? "Importando…" : "Confirmar importación"}
          </Button>
        </div>
      </div>
    </div>
  );
}
