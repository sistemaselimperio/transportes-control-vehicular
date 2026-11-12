"use client";

import { Check, FileText, Loader2, ScanLine } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { optimizeFile } from "@/modules/documents/ui/optimize-file";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { importExpensesAction, prepareImportUploadAction } from "../application/petty-cash-actions";

/** Same limits as the server (`invoice-import.ts`); checked here first to answer before uploading. */
const MAX_PDF_PAGES = 15;
const MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Kind = "photo" | "pdf";
type Stage = "uploading" | "reading";

export interface ImportState {
  kind: Kind;
  stage: Stage;
  fileName: string;
}

/** Uploads straight to storage: a scanned PDF is bigger than a server-action body may be. */
async function uploadToStorage(uploadUrl: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
  return res.ok;
}

async function prepare(file: File, kind: Kind): Promise<File | string> {
  if (kind === "photo") {
    if (!PHOTO_TYPES.includes(file.type)) return "Elige una foto JPG, PNG o WebP.";
    return optimizeFile(file);
  }
  if (file.type !== "application/pdf") return "Elige un archivo PDF.";
  if (file.size > MAX_BYTES) return "El archivo supera el límite de 20 MB.";
  const { PDFDocument } = await import("pdf-lib");
  const pages = (await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })).getPageCount();
  if (pages > MAX_PDF_PAGES) return `El PDF tiene ${pages} hojas; el máximo es ${MAX_PDF_PAGES}.`;
  // Scanned PDFs shrink a lot as JPEG pages; digital ones keep their text layer for the AI.
  return optimizeFile(file, { keepDigitalPdf: true });
}

/**
 * State of the "Desde foto" / "Desde PDF" flow: the AI reads the invoices and adds them to the
 * ledger, ready to review. `state` is null while idle; the buttons and the progress panel read it.
 */
export function useInvoiceImport(ledgerId: number, onResult: (result: ActionResult) => void) {
  const photoInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState | null>(null);

  async function start(file: File | undefined, kind: Kind) {
    if (!file) return;
    setState({ kind, stage: "uploading", fileName: file.name });
    try {
      const ready = await prepare(file, kind);
      if (typeof ready === "string") return onResult({ ok: false, error: ready });
      const target = await prepareImportUploadAction();
      if (!target.ok) return onResult({ ok: false, error: target.error });
      if (!(await uploadToStorage(target.uploadUrl, ready))) {
        return onResult({ ok: false, error: "No se pudo subir el archivo. Intenta de nuevo." });
      }
      setState({ kind, stage: "reading", fileName: file.name });
      onResult(await importExpensesAction(ledgerId, target.path, file.name));
    } catch (e) {
      console.error("petty cash import failed", e);
      onResult({ ok: false, error: "No se pudo leer el archivo. Revisa que no esté dañado e intenta de nuevo." });
    } finally {
      setState(null);
    }
  }

  const onPick = (kind: Kind) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    void start(file, kind);
  };

  return { state, photoInput, pdfInput, onPick };
}

export type InvoiceImport = ReturnType<typeof useInvoiceImport>;

/** The two hidden file inputs plus the "Desde foto" / "Desde PDF" buttons; `className` sizes each button. */
export function ImportButtons({ controller, className }: { controller: InvoiceImport; className?: string }) {
  const { state, photoInput, pdfInput, onPick } = controller;
  const busy = state !== null;
  return (
    <>
      <input
        ref={photoInput}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={onPick("photo")}
      />
      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={onPick("pdf")}
      />
      <Button
        variant="outline"
        className={cn("h-11 px-4 md:h-10", className)}
        disabled={busy}
        onClick={() => photoInput.current?.click()}
        title="La IA lee una foto de una factura y la agrega por revisar"
      >
        {state?.kind === "photo" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <ScanLine aria-hidden />}
        Desde foto
      </Button>
      <Button
        variant="outline"
        className={cn("h-11 px-4 md:h-10", className)}
        disabled={busy}
        onClick={() => pdfInput.current?.click()}
        title="La IA lee un PDF de hasta 15 hojas y agrega cada factura por revisar"
      >
        {state?.kind === "pdf" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <FileText aria-hidden />}
        Desde PDF
      </Button>
    </>
  );
}

const STEPS: ReadonlyArray<{ stage: Stage | "saving"; label: string }> = [
  { stage: "uploading", label: "Subiendo archivo" },
  { stage: "reading", label: "Leyendo facturas con IA" },
  { stage: "saving", label: "Agregando gastos" },
];

/** Inline progress of an import in course: what is happening now and that it can take up to a minute. */
export function ImportProgress({ state }: { state: ImportState }) {
  const current = STEPS.findIndex((s) => s.stage === state.stage);
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">Leyendo {state.kind === "pdf" ? "el PDF" : "la foto"}</p>
          <p className="truncate text-sm text-muted-foreground">{state.fileName}</p>
        </div>
      </div>
      <ol className="mt-4 grid gap-2.5 text-sm">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.stage} className={cn("flex items-center gap-2.5", !done && !active && "text-muted-foreground")}>
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done && "border-transparent bg-ok text-ok-foreground",
                  active && "border-brand bg-secondary text-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn(active && "font-semibold")}>{step.label}</span>
              {done && <span className="sr-only">(listo)</span>}
              {active && <span className="sr-only">(en curso)</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">Puede tardar hasta un minuto. No cierres esta pantalla.</p>
    </div>
  );
}
