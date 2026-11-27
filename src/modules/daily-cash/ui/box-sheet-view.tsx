"use client";

import { AlertTriangle, ArrowLeft, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { PesosInput } from "@/components/app/pesos-input";
import { SlideOver } from "@/components/app/slide-over";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActionMenu } from "@/modules/petty-cash/ui/action-menu";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { closeBoxAction, deleteBoxAction, deleteEntryAction, reopenBoxAction, setOpeningBalanceAction } from "../application/daily-cash-actions";
import { carriedFromEmptyCount } from "../domain/box-balances";
import type { BoxSheet, EntryRow } from "../domain/daily-cash-rows";
import { COMPANIES, COMPANY_LABELS, type Company } from "../domain/voucher-import";
import { ArqueoPanel } from "./arqueo-panel";
import { StatusBadge } from "./box-badges";
import { EntryForm } from "./entry-form";
import { VoucherImport } from "./voucher-import";

type EntryDialog = { kind: "expense" | "income"; entry?: EntryRow };

const CELL = "px-3 py-2.5";
const TOTAL_ROW = "border-t-2 bg-muted/40 font-semibold";

/** The sheet of one box: expenses by company, incomes and the arqueo, laid out like the paper sheet. */
export function BoxSheetView({ sheet }: { sheet: BoxSheet }) {
  const { figures } = sheet;
  const router = useRouter();
  const editable = figures.status === "open";
  const [dialog, setDialog] = useState<EntryDialog | undefined>();
  const [deleting, setDeleting] = useState<EntryRow | undefined>();
  const [deletingBox, setDeletingBox] = useState(false);
  const [openingDialog, setOpeningDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { message, flash } = useFlashMessage();

  const expenses = sheet.entries.filter((e) => e.kind === "expense");
  const incomes = sheet.entries.filter((e) => e.kind === "income");

  const menuFor = (entry: EntryRow) => [
    ...(entry.source === "manual" ? [{ label: "Editar", icon: Pencil, onSelect: () => setDialog({ kind: entry.kind, entry }) }] : []),
    { label: "Eliminar", icon: Trash2, onSelect: () => setDeleting(entry), destructive: true },
  ];

  function changeStatus() {
    setError(null);
    startTransition(async () => {
      const result = await (editable ? closeBoxAction(figures.id) : reopenBoxAction(figures.id));
      if (result.ok) flash(result.message);
      else setError(result.error);
    });
  }

  const entryMenu = (entry: EntryRow) =>
    editable ? <ActionMenu label={`Más acciones de ${entry.detail}`} items={menuFor(entry)} /> : null;

  return (
    <section className="space-y-5">
      <Link href="/caja-diaria" className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 h-11 px-2 md:h-9")}>
        <ArrowLeft aria-hidden />
        Cajas
      </Link>

      <PageHeader
        title={`Caja del ${formatDisplayDate(figures.date)}`}
        description={<StatusBadge status={figures.status} />}
        actions={
          <>
            {editable && (
              <>
                <VoucherImport boxId={figures.id} onDone={flash} />
                <Button variant="outline" className="h-11 px-4 md:h-10" onClick={() => setDialog({ kind: "expense" })}>
                  <Plus aria-hidden />
                  Egreso
                </Button>
                <Button variant="outline" className="h-11 px-4 md:h-10" onClick={() => setDialog({ kind: "income" })}>
                  <Plus aria-hidden />
                  Ingreso
                </Button>
              </>
            )}
            <Button
              className="h-11 px-4 md:h-10"
              variant={editable ? "default" : "outline"}
              onClick={changeStatus}
              disabled={pending || (editable && sheet.closeBlockedBy !== null)}
              title={editable && sheet.closeBlockedBy ? `Cierra primero la caja del ${formatDisplayDate(sheet.closeBlockedBy)}` : undefined}
            >
              {editable ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
              {editable ? "Cerrar caja" : "Abrir de nuevo"}
            </Button>
            {editable && <ActionMenu label="Más acciones de la caja" items={[{ label: "Eliminar caja", icon: Trash2, onSelect: () => setDeletingBox(true), destructive: true }]} />}
          </>
        }
      />

      {error && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {!editable && <p className="text-sm text-muted-foreground">La caja está cerrada: solo se puede consultar. Ábrela de nuevo para modificarla.</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="expenses-title" className="space-y-2">
            <h2 id="expenses-title" className="text-base font-semibold">
              Egresos
            </h2>
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <caption className="sr-only">Egresos de la caja por empresa</caption>
                <thead>
                  <tr className="border-b bg-muted/60 text-left">
                    <th scope="col" className={cn(CELL, "micro-label font-medium")}>
                      Detalle
                    </th>
                    {COMPANIES.map((c) => (
                      <HeaderPair key={c} company={c} />
                    ))}
                    <th scope="col" className="w-px px-2">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className={cn(CELL, "text-center text-muted-foreground")}>
                        Sin egresos todavía. Importa los comprobantes o agrega un egreso a mano.
                      </td>
                    </tr>
                  )}
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className={cn(CELL, "min-w-56")}>
                        {e.detail}
                        {e.source === "manual" && <span className="ml-2 text-xs text-muted-foreground">(manual)</span>}
                      </td>
                      <CompanyCells entry={e} company="EC1" />
                      <CompanyCells entry={e} company="EGT" />
                      <td className="px-2 py-1">{entryMenu(e)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={TOTAL_ROW}>
                    <th scope="row" className={cn(CELL, "text-left")}>
                      Total por empresa
                    </th>
                    <td className={cn(CELL, "num text-right")}>{formatPrice(figures.ec1Total)}</td>
                    <td />
                    <td className={cn(CELL, "num text-right")}>{formatPrice(figures.egtTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr className="bg-muted/40 font-semibold">
                    <th scope="row" className={cn(CELL, "text-left")}>
                      TE · Total egresos cajas
                    </th>
                    <td colSpan={3} className={cn(CELL, "num text-right text-base")}>
                      {formatPrice(figures.totalExpenses)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section aria-labelledby="incomes-title" className="space-y-2">
            <h2 id="incomes-title" className="text-base font-semibold">
              Ingresos
            </h2>
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <caption className="sr-only">Ingresos de la caja</caption>
                <tbody className="divide-y">
                  <tr>
                    <td className={CELL}>
                      {figures.carriedFromDate ? `Saldo caja del ${formatDisplayDate(figures.carriedFromDate)}` : "Saldo inicial de la caja"}
                      {carriedFromEmptyCount(figures) && (
                        <span role="note" className="mt-1 flex items-center gap-1 text-xs font-medium text-warn-foreground">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          El saldo es 0 porque el arqueo de la caja anterior está vacío.
                        </span>
                      )}
                      {sheet.isFirst && editable && (
                        <button
                          type="button"
                          onClick={() => setOpeningDialog(true)}
                          className="ml-2 text-xs font-medium text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
                        >
                          Cambiar
                        </button>
                      )}
                    </td>
                    <td className={cn(CELL, "num text-right")}>{formatPrice(figures.openingIncome)}</td>
                    <td className="w-px px-2" />
                  </tr>
                  {incomes.map((e) => (
                    <tr key={e.id}>
                      <td className={CELL}>{e.detail}</td>
                      <td className={cn(CELL, "num text-right")}>{formatPrice(e.value)}</td>
                      <td className="px-2 py-1">{entryMenu(e)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <th scope="row" className={cn(CELL, "text-left")}>
                      TI · Total ingresos
                    </th>
                    <td className={cn(CELL, "num text-right text-base")}>{formatPrice(figures.totalIncomes)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        <ArqueoPanel
          key={JSON.stringify(sheet.counts)}
          boxId={figures.id}
          counts={sheet.counts}
          expected={figures.expected}
          editable={editable}
          onDone={flash}
        />
      </div>

      <FlashMessage message={message} />

      <SlideOver
        open={dialog !== undefined}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={`${dialog?.entry ? "Editar" : "Nuevo"} ${dialog?.kind === "income" ? "ingreso" : "egreso"}`}
        description={dialog?.kind === "income" ? "Dinero que entra a la caja, por ejemplo una recarga." : "Gasto de la caja sin comprobante del software."}
      >
        {dialog && (
          <EntryForm
            boxId={figures.id}
            kind={dialog.kind}
            entry={dialog.entry}
            onCancel={() => setDialog(undefined)}
            onDone={(msg) => {
              flash(msg);
              setDialog(undefined);
            }}
          />
        )}
      </SlideOver>

      <SlideOver open={openingDialog} onOpenChange={setOpeningDialog} title="Saldo inicial" description="Efectivo con el que empieza la primera caja.">
        <ActionForm
          action={(fd) => setOpeningBalanceAction(figures.id, fd)}
          submitLabel="Guardar"
          onCancel={() => setOpeningDialog(false)}
          onDone={(msg) => {
            flash(msg);
            setOpeningDialog(false);
          }}
        >
          <Field label="Saldo inicial" htmlFor="opening-balance" required>
            <PesosInput id="opening-balance" name="openingBalance" defaultValue={sheet.openingBalance} required />
          </Field>
        </ActionForm>
      </SlideOver>

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title={deleting?.kind === "income" ? "Eliminar ingreso" : "Eliminar egreso"}
        description={deleting?.detail}
        warning={
          deleting?.voucherNumber
            ? `Se eliminará el comprobante ${deleting.company} ${deleting.voucherNumber}; podrás importarlo de nuevo.`
            : "Se eliminará este movimiento de la caja."
        }
        action={() => (deleting ? deleteEntryAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin movimiento." }))}
        onClose={() => setDeleting(undefined)}
        onDone={flash}
      />

      <ConfirmDeleteDialog
        open={deletingBox}
        title="Eliminar caja"
        description={formatDisplayDate(figures.date)}
        warning="Se eliminará la caja con sus egresos, ingresos y arqueo. Solo se puede eliminar la última caja."
        action={() => deleteBoxAction(figures.id)}
        onClose={() => setDeletingBox(false)}
        onDone={() => router.replace("/caja-diaria")}
      />
    </section>
  );
}

function HeaderPair({ company }: { company: Company }) {
  return (
    <>
      <th scope="col" className={cn(CELL, "micro-label text-right font-medium")}>
        Valor {company}
        <span className="sr-only"> ({COMPANY_LABELS[company]})</span>
      </th>
      <th scope="col" className={cn(CELL, "micro-label text-right font-medium")}>
        Comprobante {company}
      </th>
    </>
  );
}

/** The value and the voucher of an expense under its company's columns; the other company's stay empty. */
function CompanyCells({ entry, company }: { entry: EntryRow; company: Company }) {
  if (entry.company !== company) {
    return (
      <>
        <td />
        <td />
      </>
    );
  }
  return (
    <>
      <td className={cn(CELL, "num text-right")}>{formatPrice(entry.value)}</td>
      <td className={cn(CELL, "num text-right text-muted-foreground")}>{entry.voucherNumber ?? ""}</td>
    </>
  );
}
