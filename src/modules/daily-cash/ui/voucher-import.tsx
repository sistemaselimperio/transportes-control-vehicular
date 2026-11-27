"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { confirmVoucherImportAction, previewVoucherImportAction, type ImportPreview } from "../application/daily-cash-actions";

const DUPLICATE_LABELS = { stored: "ya registrado", repeated: "repetido en los archivos" } as const;

function formData(files: readonly File[]): FormData {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  return fd;
}

/** A list under a heading, capped so a long upload does not bury the confirm button. */
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">
        {title} <span className="num text-muted-foreground">({count})</span>
      </h3>
      <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm">{children}</ul>
    </div>
  );
}

/**
 * Imports the accounting software's voucher exports (EC1 and/or EGT) into the open box. Step one reads
 * the files and shows what would be saved; step two saves it. The server reads the files again on
 * confirm, so what is saved is never what the preview claimed.
 */
function ImportPanel({ boxId, onDone, onCancel }: { boxId: number; onDone: (message: string) => void; onCancel: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const busy = reading || saving;

  function choose(list: FileList | null) {
    const chosen = list ? [...list] : [];
    setFiles(chosen);
    setPreview(null);
    setError(null);
    if (chosen.length === 0) return;
    startReading(async () => {
      const result = await previewVoucherImportAction(formData(chosen));
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    });
  }

  function confirm() {
    setError(null);
    startSaving(async () => {
      const result = await confirmVoucherImportAction(boxId, formData(files));
      if (result.ok) onDone(result.message);
      else setError(result.error);
    });
  }

  return (
    <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        <Field
          label="Archivos de comprobantes"
          htmlFor="voucher-files"
          hint="Excel (.xlsx) de EC1 y/o EGT, hasta 2 MB cada uno. Cada comprobante entra a esta caja según su tipo, sin importar su fecha."
        >
          <Input
            id="voucher-files"
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="h-auto py-2"
            disabled={busy}
            onChange={(e) => choose(e.target.files)}
          />
        </Field>

        {reading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Leyendo los archivos…
          </p>
        )}

        {preview && (
          <div className="space-y-4" aria-live="polite">
            {preview.fileErrors.map((f) => (
              <p key={f.file} role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
                {f.file}: {f.error}
              </p>
            ))}

            <p className="text-sm">
              <span className="num font-semibold">{preview.toImport.length}</span> para importar ·{" "}
              <span className="num font-semibold">{preview.duplicates.length}</span> repetidos ·{" "}
              <span className="num font-semibold">{preview.skipped.length}</span> omitidos
            </p>

            <Section title="Para importar" count={preview.toImport.length}>
              {preview.toImport.map((r) => (
                <li key={`${r.company}:${r.voucherNumber}`} className="flex items-start justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="num font-medium">
                      {r.company} {r.voucherNumber}
                    </span>{" "}
                    <span className="text-muted-foreground">{r.detail}</span>
                  </span>
                  <span className="num shrink-0 font-medium">{formatPrice(r.value)}</span>
                </li>
              ))}
            </Section>

            <Section title="Repetidos (no se importan)" count={preview.duplicates.length}>
              {preview.duplicates.map(({ row, reason }) => (
                <li key={`${row.file}:${row.rowNumber}`} className="px-3 py-2">
                  <span className="num font-medium">
                    {row.company} {row.voucherNumber}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    · {DUPLICATE_LABELS[reason]} · {row.file}, fila {row.rowNumber}
                  </span>
                </li>
              ))}
            </Section>

            <Section title="Omitidos" count={preview.skipped.length}>
              {preview.skipped.map((s) => (
                <li key={`${s.file}:${s.rowNumber}`} className="px-3 py-2">
                  <span className="text-muted-foreground">
                    {s.file}, fila {s.rowNumber}:
                  </span>{" "}
                  {s.reason}
                </li>
              ))}
            </Section>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" className="h-11 px-4 md:h-10" onClick={confirm} disabled={busy || !preview || preview.toImport.length === 0}>
            {saving ? "Importando…" : "Confirmar importación"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function VoucherImport({ boxId, onDone }: { boxId: number; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="h-11 px-4 md:h-10" onClick={() => setOpen(true)}>
        <FileSpreadsheet aria-hidden />
        Importar Excel
      </Button>
      <SlideOver open={open} onOpenChange={setOpen} wide title="Importar comprobantes" description="Revisa antes de guardar: nada se escribe hasta confirmar.">
        <ImportPanel
          boxId={boxId}
          onCancel={() => setOpen(false)}
          onDone={(message) => {
            onDone(message);
            setOpen(false);
          }}
        />
      </SlideOver>
    </>
  );
}
