"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { createFreeLoadAction, updateFreeLoadAction } from "../application/load-actions";
import { NOTES_MAX, REFERENCE_MAX } from "../application/load-schemas";
import { costOf, freeLoadRows, freeRowsError } from "../domain/load-lines";
import { formatCop, LOAD_SUPPLIERS, type LoadRow } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

/** A row as typed: kilos as text and the value as the formatted pesos text. */
interface RowDraft {
  key: number;
  siesaNumber: string;
  orderNumber: string;
  kg: string;
  cost: string;
}

const kgOf = (text: string): number => (/^\d{1,8}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);

/**
 * A load made without an order: supplier, day, plate and one row per SIESA (supplier order, kilos and
 * value). It has no products and is never linked to orders. With `load` it edits a free load.
 */
export function FreeLoadForm({
  load,
  plates,
  onDone,
  onCancel,
}: {
  /** The free load being edited; without it the form creates one. */
  load?: LoadRow;
  /** Plates of the registered fleet: the only ones that can be picked. */
  plates: readonly string[];
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = load && !plates.includes(load.plate) ? [load.plate, ...plates] : plates;
  const [nextKey, setNextKey] = useState(() => (load ? freeLoadRows(load.lines).length : 1));
  const [rows, setRows] = useState<RowDraft[]>(() =>
    load
      ? freeLoadRows(load.lines).map((r, key) => ({ key, siesaNumber: r.siesaNumber, orderNumber: r.orderNumber, kg: String(r.kg), cost: String(r.cost) }))
      : [{ key: 0, siesaNumber: "", orderNumber: "", kg: "", cost: "" }],
  );

  const patch = (key: number, change: Partial<RowDraft>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const parsed = rows.map((r) => ({ siesaNumber: r.siesaNumber.trim(), orderNumber: r.orderNumber.trim(), kg: kgOf(r.kg), cost: costOf(r.cost) }));
  const totalKg = parsed.reduce((sum, r) => sum + (Number.isFinite(r.kg) ? r.kg : 0), 0);
  const totalCost = parsed.reduce((sum, r) => sum + r.cost, 0);

  return (
    <ActionForm
      action={(fd) => {
        // The same rule the server enforces, so the loader sees what to fix before sending.
        const problem = freeRowsError(parsed);
        if (problem !== null) return Promise.resolve({ ok: false as const, error: problem });
        fd.set(
          "rows",
          JSON.stringify(rows.map((r) => ({ siesaNumber: r.siesaNumber, orderNumber: r.orderNumber, kg: r.kg.trim(), cost: r.cost }))),
        );
        return load ? updateFreeLoadAction(load.id, fd) : createFreeLoadAction(fd);
      }}
      submitLabel={load ? "Guardar cambios" : "Registrar cargue"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Proveedor" htmlFor="free-load-supplier" required>
          <NativeSelect id="free-load-supplier" name="supplier" defaultValue={load?.supplier ?? ""} required>
            <option value="" disabled>
              Elige un proveedor
            </option>
            {LOAD_SUPPLIERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Fecha" htmlFor="free-load-date" required>
          <Input id="free-load-date" name="date" type="date" className={FIELD} defaultValue={load?.date ?? today} required />
        </Field>
      </div>
      <Field label="Placa" htmlFor="free-load-plate" required>
        <NativeSelect id="free-load-plate" name="plate" defaultValue={load?.plate ?? ""} required>
          <option value="" disabled>
            Elige una placa
          </option>
          {plateOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Números SIESA del cargue</legend>
        <ul className="space-y-3">
          {rows.map((row, i) => (
            <li key={row.key}>
              <section aria-label={`SIESA ${i + 1}`} className="space-y-3 rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">SIESA {i + 1}</p>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="-my-1 -mr-2 size-11 text-destructive md:size-9"
                      aria-label={`Quitar SIESA ${i + 1}`}
                      title="Quitar"
                      onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Número SIESA" htmlFor={`free-siesa-${row.key}`} required>
                    <Input
                      id={`free-siesa-${row.key}`}
                      className={`${FIELD} num`}
                      value={row.siesaNumber}
                      maxLength={REFERENCE_MAX}
                      autoComplete="off"
                      onChange={(e) => patch(row.key, { siesaNumber: e.target.value })}
                    />
                  </Field>
                  <Field label="Pedido proveedor" htmlFor={`free-order-${row.key}`} required>
                    <Input
                      id={`free-order-${row.key}`}
                      className={`${FIELD} num`}
                      value={row.orderNumber}
                      maxLength={REFERENCE_MAX}
                      autoComplete="off"
                      onChange={(e) => patch(row.key, { orderNumber: e.target.value })}
                    />
                  </Field>
                  <Field label="Peso (kg)" htmlFor={`free-kg-${row.key}`} required>
                    <Input
                      id={`free-kg-${row.key}`}
                      className={`${FIELD} num`}
                      inputMode="numeric"
                      value={row.kg}
                      autoComplete="off"
                      onChange={(e) => patch(row.key, { kg: e.target.value.replace(/\D/g, "") })}
                    />
                  </Field>
                  <Field label="Valor (COP)" htmlFor={`free-cost-${row.key}`} required>
                    <PesosInput
                      id={`free-cost-${row.key}`}
                      name={`free-cost-${row.key}`}
                      defaultValue={row.cost === "" ? undefined : costOf(row.cost)}
                      onValueChange={(next) => patch(row.key, { cost: next })}
                    />
                  </Field>
                </div>
              </section>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => {
            setRows((all) => [...all, { key: nextKey, siesaNumber: "", orderNumber: "", kg: "", cost: "" }]);
            setNextKey(nextKey + 1);
          }}
        >
          <Plus aria-hidden /> otro SIESA
        </Button>
      </fieldset>

      <p className="num text-sm text-muted-foreground" aria-live="polite">
        {formatDecimal(totalKg, 0)} kg · {formatCop(totalCost)}
      </p>

      <Field label="Observación" htmlFor="free-load-notes" hint="Opcional">
        <Textarea id="free-load-notes" name="notes" rows={3} maxLength={NOTES_MAX} defaultValue={load?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
