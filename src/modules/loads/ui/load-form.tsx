"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { orderTotals, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDisplayDate, todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { searchKey } from "@/modules/shared/domain/search-key";
import { createLoadAction, updateLoadAction } from "../application/load-actions";
import { MAX_LINES, NOTES_MAX, PRODUCT_MAX, REFERENCE_MAX } from "../application/load-schemas";
import { orderedVersusLoaded, reconcileDrafts, suggestLines, type LineDraft } from "../domain/load-lines";
import { LOAD_SUPPLIERS, type LoadRow } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

/** "+1,5", "-0,5" or "0": a difference with its sign. */
const formatSigned = (value: number): string => `${value > 0 ? "+" : ""}${formatDecimal(value, 3)}`;

const emptyLine = (key: number): LineDraft => ({ key, reference: "", tons: "", cost: "", siesaNumber: "", orderNumber: "", auto: false });

const nextKey = (drafts: readonly LineDraft[]): number => Math.max(-1, ...drafts.map((d) => d.key)) + 1;

/** The JSON the server action parses: what was typed, as text. */
const serializeLines = (drafts: readonly LineDraft[]): string =>
  JSON.stringify(
    drafts.map((d) => ({ reference: d.reference, tons: d.tons, cost: d.cost, siesaNumber: d.siesaNumber, orderNumber: d.orderNumber })),
  );

/** Creates a load, or edits `load` when given. */
export function LoadForm({
  load,
  plates,
  orders,
  references,
  kgPerBag,
  presetOrderId = null,
  onDone,
  onCancel,
}: {
  load?: LoadRow;
  /** Plates of the registered fleet: the only ones that can be picked. */
  plates: readonly string[];
  /** Pending orders, plus those already linked to a load; only the pending ones and this load's own are offered. */
  orders: readonly OrderRow[];
  /** The product catalog (shared with the orders): suggestions, never a limit. */
  references: readonly string[];
  kgPerBag: number;
  /** A pending order checked from the start (the "Crear cargue" shortcut of the orders page). */
  presetOrderId?: number | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const listId = useId();
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = load && !plates.includes(load.plate) ? [load.plate, ...plates] : plates;
  const available = orders.filter((o) => o.status === "pendiente" || (load !== undefined && o.loadId === load.id));
  const suggestionsOf = (ids: ReadonlySet<number>) => suggestLines(available.filter((o) => ids.has(o.id)), kgPerBag);

  const [checked, setChecked] = useState<ReadonlySet<number>>(() => {
    if (load) return new Set(load.orders.map((o) => o.id));
    return presetOrderId !== null && available.some((o) => o.id === presetOrderId) ? new Set([presetOrderId]) : new Set();
  });
  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (load) {
      return load.lines.map((l, key) => ({
        key,
        reference: l.referenceName ?? "",
        tons: String(l.tons),
        cost: String(l.cost),
        siesaNumber: l.siesaNumber,
        orderNumber: l.orderNumber,
        auto: false,
        legacy: l.referenceId === null,
      }));
    }
    return checked.size > 0 ? reconcileDrafts([], suggestionsOf(checked), 0) : [emptyLine(0)];
  });
  const knownKeys = new Set(references.map(searchKey));

  const suggestions = suggestionsOf(checked);
  const comparison = orderedVersusLoaded(lines, suggestions);
  const compared = (reference: string) => comparison.find((c) => searchKey(c.referenceName) === searchKey(reference));
  const firstLineOf = (reference: string) => lines.find((l) => searchKey(l.reference) === searchKey(reference));
  const uncovered = comparison.filter((c) => firstLineOf(c.referenceName) === undefined);

  function toggle(id: number, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    setChecked(next);
    // The checked orders suggest one line per product; what the user already entered stays.
    setLines((all) => reconcileDrafts(all, suggestionsOf(next), nextKey(all)));
  }

  /** An edited line stops following the orders. */
  const patch = (key: number, change: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change, auto: false } : l)));

  return (
    <ActionForm
      action={(fd) => {
        fd.set("lines", serializeLines(lines));
        return load ? updateLoadAction(load.id, fd) : createLoadAction(fd);
      }}
      submitLabel={load ? "Guardar cambios" : "Registrar cargue"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="load-date" required>
          <Input id="load-date" name="date" type="date" className={FIELD} defaultValue={load?.date ?? today} required />
        </Field>
        <Field label="Proveedor" htmlFor="load-supplier" required>
          <NativeSelect id="load-supplier" name="supplier" defaultValue={load?.supplier ?? ""} required>
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
      </div>
      <Field label="Placa" htmlFor="load-plate" required>
        <NativeSelect id="load-plate" name="plate" defaultValue={load?.plate ?? ""} required>
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
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pedidos</legend>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pedidos pendientes.</p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {available.map((o) => {
              const totals = orderTotals(o.lines, kgPerBag);
              const clientNames = [...new Set(o.lines.map((l) => l.clientName))].join(", ");
              return (
                <li key={o.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card p-2.5 text-sm has-checked:border-ring has-checked:bg-muted/50">
                    <input
                      type="checkbox"
                      name="orderIds"
                      value={o.id}
                      checked={checked.has(o.id)}
                      onChange={(e) => toggle(o.id, e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="min-w-0">
                      <span className="font-medium">Pedido #{o.id}</span>
                      <span className="num text-muted-foreground"> · {formatDisplayDate(o.deliveryDate)}</span>
                      <span className="block truncate text-muted-foreground">{clientNames}</span>
                      <span className="num block text-muted-foreground">
                        {formatDecimal(totals.bags, 0)} bultos · {formatDecimal(totals.tons, 3)} t
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <datalist id={listId}>
        {references.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Productos</legend>
        {lines.map((line, index) => {
          const typed = line.reference.trim();
          const vs = compared(line.reference);
          const showsDifference = vs !== undefined && firstLineOf(line.reference)?.key === line.key;
          return (
            <div key={line.key} className="space-y-3 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="micro-label">Producto {index + 1}</p>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-my-1 size-11 text-destructive md:size-9"
                    aria-label={`Quitar producto ${index + 1}`}
                    title="Quitar producto"
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field
                  label="Producto"
                  htmlFor={`load-product-${line.key}`}
                  required
                  hint={
                    typed === "" && line.legacy
                      ? "Sin producto: elige uno para poder guardar."
                      : typed !== "" && !knownKeys.has(searchKey(typed))
                        ? "Producto nuevo: se creará al guardar."
                        : undefined
                  }
                >
                  <Input
                    id={`load-product-${line.key}`}
                    list={listId}
                    className={FIELD}
                    value={line.reference}
                    maxLength={PRODUCT_MAX}
                    autoComplete="off"
                    required
                    onChange={(e) => patch(line.key, { reference: e.target.value })}
                  />
                </Field>
                <Field label="Toneladas" htmlFor={`load-tons-${line.key}`} required>
                  <Input
                    id={`load-tons-${line.key}`}
                    inputMode="decimal"
                    className={`${FIELD} num`}
                    value={line.tons}
                    autoComplete="off"
                    required
                    onChange={(e) => patch(line.key, { tons: e.target.value })}
                  />
                </Field>
              </div>
              {showsDifference && (
                <p className="num -mt-1 text-xs text-muted-foreground" aria-live="polite">
                  Pedido {formatDecimal(vs.ordered, 3)} t · {formatSigned(vs.difference)}
                </p>
              )}
              <Field label="Costo (COP)" htmlFor={`load-cost-${line.key}`} required>
                <PesosInput
                  id={`load-cost-${line.key}`}
                  name={`cost-${line.key}`}
                  defaultValue={line.cost === "" ? undefined : Number(line.cost.replace(/\D/g, ""))}
                  required
                  onValueChange={(cost) => patch(line.key, { cost })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Número SIESA" htmlFor={`load-siesa-${line.key}`} required hint="No se puede repetir.">
                  <Input
                    id={`load-siesa-${line.key}`}
                    className={`${FIELD} num`}
                    value={line.siesaNumber}
                    maxLength={REFERENCE_MAX}
                    autoComplete="off"
                    required
                    onChange={(e) => patch(line.key, { siesaNumber: e.target.value })}
                  />
                </Field>
                <Field label="Pedido proveedor" htmlFor={`load-order-${line.key}`} required>
                  <Input
                    id={`load-order-${line.key}`}
                    className={`${FIELD} num`}
                    value={line.orderNumber}
                    maxLength={REFERENCE_MAX}
                    autoComplete="off"
                    required
                    onChange={(e) => patch(line.key, { orderNumber: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          );
        })}
        {lines.length < MAX_LINES && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full md:h-9"
            onClick={() => setLines((all) => [...all, emptyLine(nextKey(all))])}
          >
            <Plus aria-hidden />
            Agregar producto
          </Button>
        )}
        {uncovered.length > 0 && (
          <ul className="num space-y-0.5 text-xs text-muted-foreground" aria-live="polite">
            {uncovered.map((c) => (
              <li key={c.referenceName}>
                {c.referenceName}: pedido {formatDecimal(c.ordered, 3)} t · sin cargar
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <Field label="Observación" htmlFor="load-notes" hint="Opcional">
        <Textarea id="load-notes" name="notes" rows={3} maxLength={NOTES_MAX} defaultValue={load?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
