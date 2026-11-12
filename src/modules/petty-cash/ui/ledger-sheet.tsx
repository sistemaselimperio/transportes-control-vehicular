"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import type { IsoDate } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { deleteExpenseAction, deleteLedgerAction } from "../application/petty-cash-actions";
import { formatLedgerTitle } from "../domain/ledger-date";
import type { ExpenseRow, LedgerSheet, OwnerOption, SupplierRow, VehicleOption } from "../domain/petty-cash-rows";
import { ActionMenu } from "./action-menu";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ExpenseForm } from "./expense-form";
import { ExpenseList } from "./expense-list";
import { ImportButtons, ImportProgress, useInvoiceImport } from "./import-buttons";
import { LedgerForm } from "./ledger-form";
import { LedgerPaper } from "./ledger-paper";
import { ReviewDialog } from "./review-dialog";

type View = "expenses" | "sheet";
type Toast = { tone: "ok" | "error"; text: string };

/** Final balance up front, the three figures that make it below. Stacked on phones. */
function BalanceSummary({ balance }: { balance: LedgerSheet["balance"] }) {
  const negative = balance.closingBalance < 0;
  return (
    <div className="panel shadow-soft">
      <div className="plate-head">
        <span className="micro-label">Resumen de la planilla</span>
      </div>
      <dl className="grid gap-5 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] md:items-center md:gap-8 md:p-5">
        <div>
          <dt className="micro-label">Saldo final</dt>
          <dd className={cn("num mt-2 text-4xl leading-none font-semibold md:text-[2.5rem]", negative && "text-destructive")}>
            {formatPrice(balance.closingBalance)}
          </dd>
          {negative && <p className="mt-2 text-sm font-medium text-destructive">Los gastos superan el dinero disponible.</p>}
        </div>
        <div className="grid divide-y rounded-xl border bg-muted/40 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            ["Saldo inicial", balance.openingBalance],
            ["Compense", balance.compenseAmount],
            ["Total gastos", balance.totalExpenses],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 px-4 py-3 md:block md:py-3.5">
              <dt className="text-sm text-muted-foreground md:micro-label md:text-[0.6875rem]">{label}</dt>
              <dd className="num font-semibold md:mt-2 md:text-lg">{formatPrice(Number(value))}</dd>
            </div>
          ))}
        </div>
      </dl>
    </div>
  );
}

/** First-use text of a ledger without expenses: the three ways to add one. */
function EmptyExpenses() {
  const ways = [
    { icon: Plus, title: "Nuevo gasto", text: "Escribe el detalle, el proveedor y el valor." },
    { icon: ScanLine, title: "Desde foto", text: "Fotografía una factura y la IA la lee por ti." },
    { icon: FileText, title: "Desde PDF", text: "Sube un PDF con varias facturas (hasta 15 hojas)." },
  ];
  return (
    <div className="panel p-6 text-center md:p-8">
      <h2 className="text-base font-semibold">Aún no hay gastos en esta planilla</h2>
      <p className="mt-1 text-sm text-muted-foreground">Puedes agregarlos de tres maneras con los botones de acciones:</p>
      <ul className="mx-auto mt-5 grid max-w-3xl gap-3 text-left md:grid-cols-3">
        {ways.map((w) => (
          <li key={w.title} className="flex gap-3 rounded-xl border bg-muted/40 p-3">
            <w.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{w.title}</p>
              <p className="text-sm text-muted-foreground">{w.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One ledger: on screen an app (balance, actions, expense cards or table); on paper the Excel-like
 * sheet, which is always in the page and is the only thing that prints.
 */
export function LedgerSheetView({
  sheet,
  ownerName,
  suppliers,
  vehicles,
  owners,
  today,
}: {
  sheet: LedgerSheet;
  /** The user name in capitals, for the title bar of the paper sheet. */
  ownerName: string;
  suppliers: readonly SupplierRow[];
  vehicles: readonly VehicleOption[];
  owners: readonly OwnerOption[];
  today: IsoDate;
}) {
  const router = useRouter();
  const { balance, expenses, ledgerKeys } = sheet;
  const [view, setView] = useState<View>("expenses");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | undefined>();
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRow | undefined>();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [deletingLedger, setDeletingLedger] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<number[] | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const toReview = expenses.filter((e) => e.needsReview);
  const show = (tone: Toast["tone"], text: string, ms = 6000) => {
    clearTimeout(timer.current);
    setToast({ tone, text });
    timer.current = setTimeout(() => setToast(null), ms);
  };
  const done = (msg: string) => show("ok", msg);
  // An import message can list pages that failed: give it time to be read.
  const imported = (result: ActionResult) => (result.ok ? show("ok", result.message, 12000) : show("error", result.error, 10000));
  const importer = useInvoiceImport(balance.id, imported);
  const openExpense = (expense?: ExpenseRow) => {
    setToast(null);
    setEditingExpense(expense);
    setExpenseOpen(true);
  };
  // Let the menu finish closing, or it would be on the printed page.
  const print = () => setTimeout(() => window.print(), 200);

  return (
    <section className="space-y-5 max-md:pb-28 print:pb-0">
      {/* Landscape letter for this screen only: the style exists only while the sheet is mounted. */}
      <style>{`@media print { @page { size: letter landscape; margin: 8mm; } }`}</style>

      <div className="space-y-3 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/caja"
            className={buttonVariants({ variant: "ghost", className: "-ml-2 h-11 px-3 text-muted-foreground md:h-10" })}
          >
            <ArrowLeft aria-hidden />
            Planillas
          </Link>
          <ActionMenu
            label="Más acciones de la planilla"
            items={[
              { label: "Editar planilla", icon: Pencil, onSelect: () => setLedgerOpen(true) },
              { label: "Imprimir", icon: Printer, onSelect: print },
              { label: "Eliminar planilla", icon: Trash2, onSelect: () => setDeletingLedger(true), destructive: true },
            ]}
          />
        </div>
        <div>
          <p className="micro-label">Planilla {balance.number}</p>
          <h1 className="page-title mt-1.5">{formatLedgerTitle(balance.date)}</h1>
        </div>
      </div>

      <div className="print:hidden">
        <BalanceSummary balance={balance} />
      </div>

      {/* Primary actions: a bar pinned to the bottom on phones (thumb reach), inline from `md`. */}
      <div
        className={cn(
          "grid grid-cols-3 gap-2 print:hidden",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:border-t max-md:bg-popover max-md:px-3 max-md:pt-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:shadow-soft",
          "md:flex md:flex-wrap md:items-center",
        )}
      >
        <Button
          className="max-md:h-14 max-md:flex-col max-md:gap-1 max-md:px-1 max-md:text-xs md:h-10 md:px-4"
          disabled={importer.state !== null}
          onClick={() => openExpense()}
        >
          <Plus aria-hidden />
          Nuevo gasto
        </Button>
        <ImportButtons
          controller={importer}
          className="max-md:h-14 max-md:flex-col max-md:gap-1 max-md:px-1 max-md:text-xs"
        />
      </div>

      {importer.state && (
        <div className="print:hidden">
          <ImportProgress state={importer.state} />
        </div>
      )}

      {toReview.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn-foreground/20 bg-warn px-4 py-3 text-warn-foreground print:hidden"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {toReview.length === 1 ? "1 gasto por revisar" : `${toReview.length} gastos por revisar`}
              </p>
              <p className="text-sm">La IA los leyó de una factura: confirma que los datos sean correctos.</p>
            </div>
          </div>
          <Button
            className="h-11 w-full px-4 md:h-10 md:w-auto"
            onClick={() => setReviewQueue(toReview.map((e) => e.id))}
          >
            <ClipboardCheck aria-hidden />
            Revisar ahora
          </Button>
        </div>
      )}

      <div className="print:hidden">
        <TabBar
          label="Vista de la planilla"
          items={[
            { key: "expenses", label: "Gastos", count: expenses.length },
            { key: "sheet", label: "Vista planilla" },
          ]}
          active={view}
          onSelect={setView}
          idPrefix="ledger-tab"
          panelId="ledger-panel"
        />
      </div>

      <div id="ledger-panel" role="tabpanel" aria-labelledby={`ledger-tab-${view}`} className="space-y-4">
        <div className={cn("print:hidden", view !== "expenses" && "hidden")}>
          {expenses.length === 0 ? (
            <EmptyExpenses />
          ) : (
            <ExpenseList expenses={expenses} onEdit={openExpense} onDelete={setDeletingExpense} />
          )}
        </div>

        {/* The paper sheet stays mounted: it is what prints, whichever view is on screen. */}
        <div className={cn("space-y-3", view !== "sheet" && "hidden print:block")}>
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-sm text-muted-foreground">Así se ve la planilla al imprimirla.</p>
            <Button variant="outline" className="h-11 px-4 md:h-10" onClick={() => window.print()}>
              <Printer aria-hidden />
              Imprimir / PDF
            </Button>
          </div>
          <LedgerPaper balance={balance} expenses={expenses} ownerName={ownerName} />
        </div>
      </div>

      {toast && (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          className={cn(
            "fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-2 rounded-xl border py-3 pr-2 pl-4 text-sm shadow-soft max-md:bottom-28 print:hidden",
            toast.tone === "error"
              ? "border-destructive/30 bg-card text-destructive"
              : "border-ok-foreground/20 bg-ok text-ok-foreground",
          )}
        >
          {toast.tone === "error" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <p className="min-w-0 flex-1 py-0.5">{toast.text}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setToast(null)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deletingExpense !== undefined}
        title="Eliminar gasto"
        description={deletingExpense?.detail}
        warning="Se eliminará el gasto y su adjunto. El saldo final de esta planilla y de las siguientes se recalcula."
        action={() => (deletingExpense ? deleteExpenseAction(deletingExpense.id) : Promise.resolve({ ok: false as const, error: "Sin gasto." }))}
        onClose={() => setDeletingExpense(undefined)}
        onDone={done}
      />

      <ConfirmDeleteDialog
        open={deletingLedger}
        title="Eliminar planilla"
        description={formatLedgerTitle(balance.date)}
        warning="Se eliminará la planilla con todos sus gastos y adjuntos. Los saldos de las planillas siguientes se recalculan."
        action={() => deleteLedgerAction(balance.id)}
        onClose={() => setDeletingLedger(false)}
        onDone={() => router.replace("/caja")}
      />

      <SlideOver
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        title={editingExpense ? "Editar gasto" : "Nuevo gasto"}
        description={formatLedgerTitle(balance.date)}
        wide
      >
        <ExpenseForm
          key={editingExpense?.id ?? "new"}
          ledgerId={balance.id}
          expense={editingExpense}
          suppliers={suppliers}
          vehicles={vehicles}
          owners={owners}
          onCancel={() => setExpenseOpen(false)}
          onDone={(msg) => {
            done(msg);
            setExpenseOpen(false);
          }}
        />
      </SlideOver>

      <SlideOver open={ledgerOpen} onOpenChange={setLedgerOpen} title="Editar planilla" description={formatLedgerTitle(balance.date)}>
        <LedgerForm
          ledger={balance}
          ledgers={ledgerKeys}
          today={today}
          onCancel={() => setLedgerOpen(false)}
          onDone={(msg) => {
            done(msg);
            setLedgerOpen(false);
          }}
        />
      </SlideOver>

      {reviewQueue && (
        <ReviewDialog
          queue={reviewQueue}
          expenses={expenses}
          ledgerId={balance.id}
          suppliers={suppliers}
          vehicles={vehicles}
          owners={owners}
          onClose={() => setReviewQueue(null)}
        />
      )}
    </section>
  );
}
