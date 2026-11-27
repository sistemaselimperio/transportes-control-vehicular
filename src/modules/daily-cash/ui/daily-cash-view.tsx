"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";
import type { BoxFigures } from "../domain/box-balances";
import { BoxForm } from "./box-form";
import { DifferenceValue, StatusBadge } from "./box-badges";

/** Stretched link: the whole card or row opens the box. */
const OPEN_LINK =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50";

function EmptyBoxes({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="panel p-6 text-center md:p-10">
      <h2 className="text-lg font-semibold">Crea tu primera caja</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Hay una caja por cada día. En la primera te pediremos el saldo inicial; las siguientes parten del efectivo contado en la anterior.
      </p>
      <Button className="mt-5 h-12 px-6 md:h-11" onClick={onCreate}>
        <Plus aria-hidden />
        Nueva caja
      </Button>
    </div>
  );
}

/** Daily cash home: the boxes of the user, newest first, with their totals and difference. */
export function DailyCashView({ boxes, today }: { boxes: readonly BoxFigures[]; today: IsoDate }) {
  const [open, setOpen] = useState(false);
  const { message, flash } = useFlashMessage();
  const rows = [...boxes].reverse();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Caja menor"
        description="Una caja por día: egresos de EC1 y EGT, ingresos y arqueo."
        actions={
          rows.length > 0 ? (
            <Button className="h-11 px-4 md:h-10" onClick={() => setOpen(true)}>
              <Plus aria-hidden />
              Nueva caja
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyBoxes onCreate={() => setOpen(true)} />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="relative space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/caja-diaria/${r.id}`} className={cn("text-base font-semibold", OPEN_LINK)}>
                      {formatDisplayDate(r.date)}
                    </Link>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div>
                  <p className="micro-label">Saldo actual caja</p>
                  <p className="num mt-1.5 text-2xl leading-none font-semibold">{formatPrice(r.counted)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    Ingresos <span className="num font-medium text-foreground">{formatPrice(r.totalIncomes)}</span>
                  </span>
                  <span>
                    Egresos <span className="num font-medium text-foreground">{formatPrice(r.totalExpenses)}</span>
                  </span>
                  <span>
                    Diferencia <DifferenceValue value={r.difference} />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="panel hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Cajas menores</caption>
              <thead>
                <tr className="border-b bg-muted/60 text-left">
                  {["Fecha", "Estado", "Ingresos (TI)", "Egresos (TE)", "Saldo actual caja", "Diferencia"].map((h, i) => (
                    <th key={h} scope="col" className={cn("micro-label px-4 py-3 font-medium", i > 1 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="relative hover:bg-muted/50">
                    <td className="px-4 py-3.5">
                      <Link href={`/caja-diaria/${r.id}`} className={cn("font-medium hover:underline", OPEN_LINK)}>
                        {formatDisplayDate(r.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="num px-4 py-3.5 text-right">{formatPrice(r.totalIncomes)}</td>
                    <td className="num px-4 py-3.5 text-right">{formatPrice(r.totalExpenses)}</td>
                    <td className="num px-4 py-3.5 text-right text-base font-semibold">{formatPrice(r.counted)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <DifferenceValue value={r.difference} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <FlashMessage message={message} />

      <SlideOver open={open} onOpenChange={setOpen} title="Nueva caja" description="Una caja por cada día.">
        <BoxForm
          boxes={boxes}
          today={today}
          onCancel={() => setOpen(false)}
          onDone={(msg) => {
            flash(msg);
            setOpen(false);
          }}
        />
      </SlideOver>
    </section>
  );
}
