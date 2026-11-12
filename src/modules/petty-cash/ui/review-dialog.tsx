"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, ChevronDown, SkipForward, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExpenseRow, OwnerOption, SupplierRow, VehicleOption } from "../domain/petty-cash-rows";
import { AttachmentBody, AttachmentViewer, ExpandButton } from "./attachment-viewer";
import { ExpenseForm } from "./expense-form";

/** The attachment of an expense: an image that can be enlarged, or the PDF in a frame. */
function AttachmentPreview({ expense }: { expense: ExpenseRow }) {
  const [expanded, setExpanded] = useState(false);
  if (!expense.attachment) {
    return <p className="m-auto p-6 text-center text-sm text-muted-foreground">Este gasto no tiene adjunto.</p>;
  }
  const attachment = { expenseId: expense.id, ...expense.attachment };
  return (
    <>
      <div className="flex shrink-0 justify-end border-b bg-card px-2 py-1">
        <ExpandButton onClick={() => setExpanded(true)} />
      </div>
      <AttachmentBody key={expense.id} attachment={attachment} />
      <AttachmentViewer attachment={expanded ? attachment : null} onClose={() => setExpanded(false)} />
    </>
  );
}

/**
 * Walks through the expenses that need review, one by one: the attachment next to the form on
 * desktop, collapsible above it on phones. `queue` is fixed when it opens, so an expense that is
 * saved stays in place while the next one loads.
 */
export function ReviewDialog({
  queue,
  expenses,
  ledgerId,
  suppliers,
  vehicles,
  owners,
  onClose,
}: {
  queue: readonly number[];
  expenses: readonly ExpenseRow[];
  ledgerId: number;
  suppliers: readonly SupplierRow[];
  vehicles: readonly VehicleOption[];
  owners: readonly OwnerOption[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(true);
  // An expense deleted while the dialog was open is skipped.
  let position = index;
  while (position < queue.length && !expenses.some((e) => e.id === queue[position])) position++;
  const current = position < queue.length ? expenses.find((e) => e.id === queue[position]) : undefined;
  const next = () => setIndex(position + 1);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/35 opacity-100 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-soft outline-none transition-transform duration-200 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none md:inset-y-0 md:right-0 md:left-auto md:w-[min(72rem,94vw)] md:rounded-l-2xl md:border-l md:data-ending-style:translate-x-full md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-full md:data-starting-style:translate-y-0">
          <header className="shrink-0 border-b px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="text-base leading-snug font-semibold tracking-tight">Revisar gastos</Dialog.Title>
                <Dialog.Description className="num text-sm text-muted-foreground">
                  {current ? `${position + 1} de ${queue.length}` : "Revisión terminada"}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Cerrar"
                className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
            <div
              role="progressbar"
              aria-label="Avance de la revisión"
              aria-valuemin={0}
              aria-valuemax={queue.length}
              aria-valuenow={Math.min(position, queue.length)}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${(Math.min(position, queue.length) / Math.max(queue.length, 1)) * 100}%` }}
              />
            </div>
          </header>

          {current ? (
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div className={cn("flex shrink-0 flex-col border-b bg-card md:min-w-0 md:flex-1 md:border-r md:border-b-0", previewOpen && "h-72 md:h-auto")}>
                <button
                  type="button"
                  aria-expanded={previewOpen}
                  aria-controls="review-preview"
                  onClick={() => setPreviewOpen((o) => !o)}
                  className="flex h-11 w-full shrink-0 items-center justify-between gap-2 px-5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
                >
                  {previewOpen ? "Ocultar adjunto" : "Ver adjunto"}
                  <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", previewOpen && "rotate-180")} aria-hidden />
                </button>
                <div id="review-preview" className={cn("min-h-0 flex-1 flex-col", previewOpen ? "flex" : "hidden md:flex")}>
                  <AttachmentPreview key={current.id} expense={current} />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col md:w-[28rem] md:flex-none">
                <ExpenseForm
                  key={current.id}
                  ledgerId={ledgerId}
                  expense={current}
                  suppliers={suppliers}
                  vehicles={vehicles}
                  owners={owners}
                  submitLabel="Guardar y siguiente"
                  cancelLabel="Cerrar"
                  extraAction={
                    <Button type="button" variant="outline" className="h-11 px-4 md:h-10" onClick={next}>
                      <SkipForward aria-hidden />
                      Saltar
                    </Button>
                  }
                  onDone={() => {
                    setSaved((n) => n + 1);
                    next();
                  }}
                  onCancel={onClose}
                />
              </div>
            </div>
          ) : (
            <div className="m-auto flex max-w-sm flex-col items-center gap-3 p-8 text-center">
              <CheckCircle2 className="size-12 text-ok-foreground" aria-hidden />
              <p className="text-lg font-semibold">Terminaste la revisión</p>
              <p className="text-sm text-muted-foreground">
                {saved === 0
                  ? "No guardaste cambios en esta ronda."
                  : saved === 1
                    ? "Guardaste 1 gasto."
                    : `Guardaste ${saved} gastos.`}
                {saved < queue.length && " Los que saltaste siguen marcados como por revisar."}
              </p>
              <Button className="mt-2 h-12 px-6 md:h-11" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
