"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { CorrectedFields, FleetField } from "../domain/fleet-matching";
import { applyImportCotero, importCoteroIssues, importDateRange, type ImportCotero } from "../domain/import-cotero";
import { draftIssues, duplicateNumbers, type ReceiptDraft } from "../domain/receipt-rules";
import { normalizeReceiptNumber } from "../domain/receipt-number";
import type { Tariff } from "../domain/tariff";
import { DuplicateBadge, KnownCoteroBadge, MismatchBadge } from "./badges";
import { COTERO_DOCUMENT_HINT, ReceiptFields } from "./receipt-fields";
import type { FleetControl } from "./use-fleet";

/** A receipt of the batch under review: what was read (or typed), where its original file is and its page image. */
export interface ReviewItem {
  key: number;
  draft: ReceiptDraft;
  filePath: string | null;
  pageNumber: number | null;
  /** Object URL of the page image shown beside the fields; null for a receipt typed by hand. */
  preview: string | null;
  /** Where it comes from, for the caption ("recibos.pdf · hoja 2"). */
  source: string;
  /** The plates and driver the fleet corrected, with what the AI had read; an entry goes when that field is edited. */
  corrected: CorrectedFields;
}

const FLEET_FIELDS: readonly FleetField[] = ["vehiclePlate", "trailerPlate", "driverName"];

/**
 * The review-and-confirm screen: every receipt read from the files as an editable card with its page
 * image beside it. Missing fields, duplicate numbers (already stored or repeated here) and amounts far
 * from the tariff are marked; nothing is saved until "Guardar", and a card with a missing field or a
 * duplicate number blocks it. So does a plate or driver that is not in the active fleet (`fleet`).
 * The whole import is one cotero: a single header (`cotero`) is forced onto every receipt, whose own
 * name and cédula fields are hidden; a missing name or unreadable cédula blocks saving there.
 */
export function ReceiptReview({
  open,
  items,
  existingNumbers,
  tariffs,
  fleet,
  notes,
  cotero,
  coteroKnown,
  onCoteroChange,
  onChange,
  onAddManual,
  onCheckNumber,
  onSave,
  onCancel,
}: {
  open: boolean;
  items: readonly ReviewItem[];
  /** Normalized numbers already stored. */
  existingNumbers: ReadonlySet<string>;
  tariffs: readonly Tariff[];
  fleet: FleetControl;
  /** Things that went wrong while reading (a file or a page that could not be read). */
  notes: readonly string[];
  /** The one cotero of the import, editable in the header. */
  cotero: ImportCotero;
  /** Its cédula belongs to a cotero already registered. */
  coteroKnown: boolean;
  onCoteroChange: (cotero: ImportCotero) => void;
  onChange: (items: ReviewItem[]) => void;
  onAddManual: () => void;
  /** Called when a receipt number field is left, to ask the server whether it already exists. */
  onCheckNumber: (draft: ReceiptDraft) => void;
  /** Saves the batch; resolves to an error message, or null when it was saved. */
  onSave: () => Promise<string | null>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reviews = useMemo(() => {
    const batchDuplicates = duplicateNumbers(items.map((i) => normalizeReceiptNumber(i.draft.receiptNumber)));
    return items.map((i) => {
      const review = draftIssues(applyImportCotero(i.draft, cotero), { existingNumbers, batchDuplicates, tariffs, fleet: fleet.fleet });
      // The cotero is judged once, in the header: its issues never mark a card.
      const issues = review.issues.filter((issue) => issue.field !== "coteroName" && issue.field !== "coteroDocument");
      return { ...review, issues, blocked: issues.length > 0 || review.duplicate !== null };
    });
  }, [items, cotero, existingNumbers, tariffs, fleet.fleet]);
  const blocked = reviews.filter((r) => r.blocked).length;
  const coteroIssues = useMemo(() => importCoteroIssues(cotero), [cotero]);
  const range = useMemo(() => importDateRange(items.map((i) => i.draft)), [items]);
  const nameIssue = coteroIssues.find((i) => i.field === "coteroName");
  const documentIssue = coteroIssues.find((i) => i.field === "coteroDocument");
  const summary = `${items.length} ${items.length === 1 ? "recibo" : "recibos"}${
    range ? ` · ${range.from === range.to ? formatDisplayDate(range.from) : `${formatDisplayDate(range.from)} al ${formatDisplayDate(range.to)}`}` : ""
  }`;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      setError(await onSave());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/35 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[96dvh] flex-col rounded-t-2xl border-t bg-popover text-popover-foreground shadow-soft outline-none md:inset-6 md:max-h-none md:rounded-2xl md:border">
          <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base leading-snug font-semibold tracking-tight">Revisar recibos</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                Revisa cada recibo contra su hoja. No se guarda nada hasta que confirmes.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="-mt-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
            <section aria-label="Cotero de los recibos" className="panel space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-semibold">Cotero</h3>
                  {coteroKnown && <KnownCoteroBadge />}
                </div>
                <p className="num text-sm text-muted-foreground" aria-live="polite">
                  {summary}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nombre del cotero"
                  htmlFor="review-cotero-name"
                  required
                  hint={nameIssue ? "Falta este dato." : "Todos los recibos de esta lista se guardan a su nombre."}
                >
                  <Input
                    id="review-cotero-name"
                    autoComplete="off"
                    list="cotero-names"
                    className="h-10 md:h-9"
                    aria-invalid={nameIssue ? true : undefined}
                    value={cotero.name}
                    onChange={(e) => onCoteroChange({ ...cotero, name: e.target.value })}
                  />
                </Field>
                <Field
                  label="Cédula del cotero"
                  htmlFor="review-cotero-document"
                  hint={documentIssue ? "No se entiende este dato." : COTERO_DOCUMENT_HINT}
                >
                  <Input
                    id="review-cotero-document"
                    inputMode="numeric"
                    autoComplete="off"
                    className="h-10 md:h-9"
                    aria-invalid={documentIssue ? true : undefined}
                    value={cotero.document}
                    onChange={(e) => onCoteroChange({ ...cotero, document: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            {notes.length > 0 && (
              <ul role="status" className="space-y-1 rounded-xl border border-warn-foreground/20 bg-warn p-3 text-sm text-warn-foreground">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}

            {items.length === 0 && <p className="text-sm text-muted-foreground">No hay recibos en la lista. Agrega uno a mano.</p>}

            <ul className="space-y-4">
              {items.map((item, index) => {
                const review = reviews[index];
                const update = (draft: ReceiptDraft) =>
                  onChange(
                    items.map((i) => {
                      if (i.key !== item.key) return i;
                      // A field the person edits is theirs again: no longer "corrected".
                      const corrected = { ...i.corrected };
                      for (const field of FLEET_FIELDS) if (draft[field] !== i.draft[field]) delete corrected[field];
                      return { ...i, draft, corrected };
                    }),
                  );
                return (
                  <li
                    key={item.key}
                    className={cn(
                      "panel grid gap-4 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
                      review.blocked && "border-destructive/40",
                    )}
                  >
                    <div className="space-y-2 md:sticky md:top-0 md:self-start">
                      {item.preview ? (
                        <a href={item.preview} target="_blank" rel="noreferrer" title="Abrir la hoja en grande">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL of the page just read */}
                          <img
                            src={item.preview}
                            alt={`Hoja de ${item.source}`}
                            className="max-h-[32rem] w-full rounded-lg border bg-muted object-contain"
                          />
                        </a>
                      ) : (
                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/50 text-sm text-muted-foreground">
                          Recibo escrito a mano, sin hoja
                        </div>
                      )}
                      <p className="truncate text-xs text-muted-foreground">{item.source}</p>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="num text-sm font-semibold">Recibo {index + 1}</span>
                          {review.duplicate && <DuplicateBadge where={review.duplicate} />}
                          {review.mismatch && <MismatchBadge />}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 px-3 text-destructive md:h-9"
                          onClick={() => onChange(items.filter((i) => i.key !== item.key))}
                        >
                          <Trash2 aria-hidden />
                          Quitar
                        </Button>
                      </div>
                      <div onBlur={(e) => e.target instanceof HTMLInputElement && e.target.name === "receiptNumber" && onCheckNumber(item.draft)}>
                        <ReceiptFields
                          draft={item.draft}
                          onChange={update}
                          issues={review.issues}
                          idPrefix={`review-${item.key}`}
                          fleet={fleet}
                          corrected={item.corrected}
                          hideCotero
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="shrink-0 space-y-3 border-t bg-popover px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {coteroIssues.length > 0 && <p className="text-sm text-muted-foreground">Revisa el nombre y la cédula del cotero antes de guardar.</p>}
            {blocked > 0 && (
              <p className="text-sm text-muted-foreground">
                {blocked === 1 ? "1 recibo tiene datos por corregir" : `${blocked} recibos tienen datos por corregir`} antes de guardar.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onAddManual} disabled={saving}>
                <Plus aria-hidden />
                Agregar a mano
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={onCancel} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="button" className="h-11 px-4 md:h-10" onClick={save} disabled={saving || items.length === 0 || blocked > 0 || coteroIssues.length > 0}>
                  {saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
                  {saving ? "Guardando…" : items.length === 1 ? "Guardar recibo" : `Guardar ${items.length} recibos`}
                </Button>
              </div>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
