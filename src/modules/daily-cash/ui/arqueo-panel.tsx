"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { saveCountsAction } from "../application/daily-cash-actions";
import { countedTotal, DENOMINATIONS } from "../domain/cash-count";
import { DifferenceValue } from "./box-badges";

/** Whole number typed in a quantity field; anything else counts as zero while typing. */
const quantityOf = (text: string): number => (/^\d{1,9}$/.test(text) ? Number(text) : 0);

/**
 * The arqueo: how many bills and coins of each denomination are in the box. The counted cash is the
 * "Saldo actual caja" and, against what the box should hold (TI - TE), gives the difference.
 */
export function ArqueoPanel({
  boxId,
  counts,
  expected,
  editable,
  onDone,
}: {
  boxId: number;
  counts: Readonly<Record<number, number>>;
  /** TI - TE of the saved figures. */
  expected: number;
  editable: boolean;
  onDone: (message: string) => void;
}) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [d, counts[d] ? String(counts[d]) : ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counted = countedTotal(Object.fromEntries(DENOMINATIONS.map((d) => [d, quantityOf(values[d] ?? "")])));
  const difference = counted - expected;

  function save(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveCountsAction(boxId, fd);
      if (result.ok) onDone(result.message);
      else setError(result.error);
    });
  }

  return (
    <section aria-labelledby="arqueo-title" className="panel space-y-4 p-4">
      <h2 id="arqueo-title" className="text-base font-semibold">
        Arqueo
      </h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(new FormData(e.currentTarget));
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="micro-label pb-2 font-medium">
                Denominación
              </th>
              <th scope="col" className="micro-label pb-2 text-right font-medium">
                Cantidad
              </th>
              <th scope="col" className="micro-label pb-2 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {DENOMINATIONS.map((d) => (
              <tr key={d}>
                <th scope="row" className="num py-1 pr-2 text-left font-medium">
                  <label htmlFor={`count-${d}`}>{formatPrice(d)}</label>
                </th>
                <td className="py-1 pl-2">
                  <Input
                    id={`count-${d}`}
                    name={String(d)}
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={!editable || pending}
                    className="num h-10 text-right md:h-8"
                    value={values[d] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [d]: e.target.value.replace(/\D/g, "") }))}
                  />
                </td>
                <td className="num py-1 pl-3 text-right text-muted-foreground">{formatPrice(d * quantityOf(values[d] ?? ""))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="space-y-1.5 border-t pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-medium">Saldo actual caja</dt>
            <dd className="num text-base font-semibold">{formatPrice(counted)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">TI − TE</dt>
            <dd className="num">{formatPrice(expected)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-medium">Diferencia</dt>
            <dd>
              <DifferenceValue value={difference} className="text-base" />
            </dd>
          </div>
        </dl>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {editable && (
          <Button type="submit" className="h-11 w-full md:h-10" disabled={pending}>
            {pending ? "Guardando…" : "Guardar arqueo"}
          </Button>
        )}
      </form>
    </section>
  );
}
