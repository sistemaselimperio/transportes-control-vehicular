"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import type { IsoDate } from "@/modules/shared/domain/dates";
import { deleteLedgerAction } from "../application/petty-cash-actions";
import type { LedgerBalance } from "../domain/ledger-balances";
import { formatLedgerTitle } from "../domain/ledger-date";
import { ledgerSlug } from "../domain/ledger-slug";
import { ActionMenu } from "./action-menu";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { LedgerForm } from "./ledger-form";

function ReviewCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-warn px-1.5 py-1 text-[11px] leading-none font-semibold text-warn-foreground">
      <AlertTriangle className="size-3" aria-hidden />
      {count === 1 ? "1 por revisar" : `${count} por revisar`}
    </span>
  );
}

/** Stretched link: the whole card or row opens the ledger, while the menu stays above it. */
const OPEN_LINK =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50";

/** First use: no ledger yet. */
function EmptyLedgers({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="panel p-6 text-center md:p-10">
      <h2 className="text-lg font-semibold">Crea tu primera planilla</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Hay una planilla por cada compense. En la primera te pediremos el saldo inicial de la caja; las siguientes empiezan solas con
        el saldo final de la anterior.
      </p>
      <Button className="mt-5 h-12 px-6 md:h-11" onClick={onCreate}>
        <Plus aria-hidden />
        Nueva planilla
      </Button>
    </div>
  );
}

/** Petty-cash home: the ledgers of the user, newest first, with create / edit / delete. */
export function PettyCashView({
  balances,
  reviewCounts,
  today,
}: {
  balances: readonly LedgerBalance[];
  /** Expenses still to review, by ledger id. */
  reviewCounts: Readonly<Record<number, number>>;
  today: IsoDate;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerBalance | undefined>();
  const [deleting, setDeleting] = useState<LedgerBalance | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const rows = [...balances].reverse();

  const openForm = (ledger?: LedgerBalance) => {
    setMessage(null);
    setEditing(ledger);
    setOpen(true);
  };
  const done = (msg: string) => {
    clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 6000);
  };
  const menuFor = (r: LedgerBalance) => [
    { label: "Editar planilla", icon: Pencil, onSelect: () => openForm(r) },
    { label: "Eliminar planilla", icon: Trash2, onSelect: () => setDeleting(r), destructive: true },
  ];

  return (
    <section className="space-y-5">
      <PageHeader
        title="Caja"
        description="Una planilla por cada compense: gastos, soportes y saldo."
        actions={
          rows.length > 0 ? (
            <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
              <Plus aria-hidden />
              Nueva planilla
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyLedgers onCreate={() => openForm()} />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="relative flex items-stretch rounded-2xl border bg-card shadow-soft">
                <div className="min-w-0 flex-1 space-y-3 p-4">
                  <div>
                    <p className="micro-label">Planilla {r.number}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Link href={`/caja/${ledgerSlug(r.number)}`} className={cn("text-base font-semibold", OPEN_LINK)}>
                        {formatLedgerTitle(r.date)}
                      </Link>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                  </div>
                  <div>
                    <p className="micro-label">Saldo final</p>
                    <p className={cn("num mt-1.5 text-2xl leading-none font-semibold", r.closingBalance < 0 && "text-destructive")}>
                      {formatPrice(r.closingBalance)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                    <span>
                      Gastos <span className="num font-medium text-foreground">{formatPrice(r.totalExpenses)}</span>
                    </span>
                    <ReviewCount count={reviewCounts[r.id] ?? 0} />
                  </div>
                </div>
                <div className="relative z-10 p-1">
                  <ActionMenu label={`Más acciones de la planilla del ${formatLedgerTitle(r.date)}`} items={menuFor(r)} />
                </div>
              </li>
            ))}
          </ul>

          <div className="panel hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Planillas de caja</caption>
              <thead>
                <tr className="border-b bg-muted/60 text-left">
                  {["Planilla", "Fecha", "Saldo inicial", "Compense", "Gastos", "Saldo final"].map((h, i) => (
                    <th key={h} scope="col" className={cn("micro-label px-4 py-3 font-medium", i > 1 && "text-right")}>
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Pendientes</span>
                  </th>
                  <th scope="col" className="w-px px-2">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="relative hover:bg-muted/50">
                    <td className="num px-4 py-3.5 font-medium text-muted-foreground">{r.number}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/caja/${ledgerSlug(r.number)}`} className={cn("font-medium", OPEN_LINK, "hover:underline")}>
                        {formatLedgerTitle(r.date)}
                      </Link>
                    </td>
                    <td className="num px-4 py-3.5 text-right text-muted-foreground">{formatPrice(r.openingBalance)}</td>
                    <td className="num px-4 py-3.5 text-right text-muted-foreground">{formatPrice(r.compenseAmount)}</td>
                    <td className="num px-4 py-3.5 text-right">{formatPrice(r.totalExpenses)}</td>
                    <td className={cn("num px-4 py-3.5 text-right text-base font-semibold", r.closingBalance < 0 && "text-destructive")}>
                      {formatPrice(r.closingBalance)}
                    </td>
                    <td className="px-4 py-3.5">
                      <ReviewCount count={reviewCounts[r.id] ?? 0} />
                    </td>
                    <td className="relative z-10 px-2 py-1">
                      <ActionMenu label={`Más acciones de la planilla del ${formatLedgerTitle(r.date)}`} items={menuFor(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {message && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok py-3 pr-2 pl-4 text-sm text-ok-foreground shadow-soft"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{message}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setMessage(null)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar planilla"
        description={deleting && formatLedgerTitle(deleting.date)}
        warning="Se eliminará la planilla con todos sus gastos y adjuntos. Los saldos de las planillas siguientes se recalculan."
        action={() => (deleting ? deleteLedgerAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin planilla." }))}
        onClose={() => setDeleting(undefined)}
        onDone={done}
      />

      <SlideOver
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar planilla" : "Nueva planilla"}
        description={editing && formatLedgerTitle(editing.date)}
      >
        <LedgerForm
          ledger={editing}
          ledgers={balances}
          today={today}
          onCancel={() => setOpen(false)}
          onDone={(msg) => {
            done(msg);
            setOpen(false);
          }}
        />
      </SlideOver>
    </section>
  );
}
