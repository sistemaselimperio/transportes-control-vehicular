"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { createTariffAction } from "../application/cotero-actions";
import type { TariffRow } from "../domain/settlement-rows";
import { tariffInForce } from "../domain/tariff";
import { formatCop } from "./format";

/** The price per ton with its history. A new tariff never changes the receipts already stored. */
export function TariffPanel({ tariffs, today, onDone }: { tariffs: readonly TariffRow[]; today: string; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = tariffInForce(tariffs, today);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Cada recibo guarda la tarifa vigente en su fecha. Una tarifa nueva solo afecta a los recibos que se registren después.
        </p>
        <Button className="h-11 px-4 md:h-10" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          Agregar tarifa
        </Button>
      </div>

      {tariffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay tarifas. Agrega una para que los recibos se comparen con ella.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {tariffs.map((t) => (
            <li key={t.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="num">Desde el {formatDisplayDate(t.validFrom)}</span>
              <span className="flex items-center gap-2">
                {current?.validFrom === t.validFrom && (
                  <span className="rounded-md bg-ok px-1.5 py-1 text-[11px] leading-none font-semibold text-ok-foreground">Vigente</span>
                )}
                <span className="num font-semibold">{formatCop(t.pricePerTon)} / t</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <SlideOver open={open} onOpenChange={setOpen} title="Agregar tarifa" description="Valor por tonelada y desde qué fecha rige.">
        <ActionForm
          action={createTariffAction}
          submitLabel="Agregar"
          onCancel={() => setOpen(false)}
          onDone={(message) => {
            onDone(message);
            setOpen(false);
          }}
        >
          <Field label="Rige desde" htmlFor="tariff-from" required>
            <Input id="tariff-from" name="validFrom" type="date" required className="h-11 md:h-9" defaultValue={today} />
          </Field>
          <Field label="Valor por tonelada" htmlFor="tariff-price" required>
            <PesosInput id="tariff-price" name="pricePerTon" required />
          </Field>
        </ActionForm>
      </SlideOver>
    </section>
  );
}
