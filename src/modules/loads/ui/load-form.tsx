"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orderTotals, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDisplayDate, todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal, parseDecimal } from "@/modules/shared/domain/decimal";
import { searchKey } from "@/modules/shared/domain/search-key";
import { createLoadAction, updateLoadAction } from "../application/load-actions";
import { MAX_LINES, NOTES_MAX, PRODUCT_MAX, REFERENCE_MAX } from "../application/load-schemas";
import {
  costOf,
  draftsTotals,
  isDraftComplete,
  orderedVersusLoaded,
  reconcileDrafts,
  suggestLines,
  type LineDraft,
} from "../domain/load-lines";
import { formatCop, LOAD_SUPPLIERS, type LoadRow } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

/** "+1,5", "-0,5" or "0": a difference with its sign. */
const formatSigned = (value: number): string => `${value > 0 ? "+" : ""}${formatDecimal(value, 3)}`;

const emptyLine = (key: number): LineDraft => ({ key, reference: "", tons: "", cost: "", siesaNumber: "", orderNumber: "", auto: false });

const nextKey = (drafts: readonly LineDraft[]): number => Math.max(-1, ...drafts.map((d) => d.key)) + 1;

/** The line to open for editing: the first one that is not complete yet. */
const firstIncompleteKey = (drafts: readonly LineDraft[]): number | null => drafts.find((d) => !isDraftComplete(d))?.key ?? null;

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
  // At most one line is open; a line that is not complete starts open.
  const [openKey, setOpenKey] = useState<number | null>(() => firstIncompleteKey(lines));
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
    const reconciled = reconcileDrafts(lines, suggestionsOf(next), nextKey(lines));
    setLines(reconciled);
    // Suggested lines arrive incomplete: keep the open one, or else open the first that needs data.
    setOpenKey((open) => (open !== null && reconciled.some((l) => l.key === open) ? open : firstIncompleteKey(reconciled)));
  }

  function addLine() {
    const key = nextKey(lines);
    setLines([...lines, emptyLine(key)]);
    setOpenKey(key);
  }

  const totals = draftsTotals(lines);

  /** An edited line stops following the orders. */
  const patch = (key: number, change: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change, auto: false } : l)));

  return (
    <ActionForm
      action={(fd) => {
        // Collapsed lines keep their values in state, so nothing is lost. An incomplete one is opened here
        // instead of relying on native "required", which cannot show a message on a hidden input.
        const incomplete = firstIncompleteKey(lines);
        if (incomplete !== null) {
          setOpenKey(incomplete);
          const n = lines.findIndex((l) => l.key === incomplete) + 1;
          return Promise.resolve({ ok: false as const, error: `Completa los datos del producto ${n}.` });
        }
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
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {totals.count} {totals.count === 1 ? "producto" : "productos"} · {formatDecimal(totals.tons, 3)} t · {formatCop(totals.cost)}
        </p>
        {lines.map((line, index) => {
          const typed = line.reference.trim();
          const vs = compared(line.reference);
          const showsDifference = vs !== undefined && firstLineOf(line.reference)?.key === line.key;
          const open = openKey === line.key;
          const complete = isDraftComplete(line);
          const tons = parseDecimal(line.tons) ?? 0;
          const cost = costOf(line.cost);
          const summary = [
            tons > 0 ? `${formatDecimal(tons, 3)} t` : null,
            cost > 0 ? formatCop(cost) : null,
            line.siesaNumber.trim() !== "" ? `SIESA ${line.siesaNumber.trim()}` : null,
            showsDifference ? `Pedido ${formatDecimal(vs.ordered, 3)} t (${formatSigned(vs.difference)})` : null,
          ].filter((part): part is string => part !== null);
          const bodyId = `load-line-${line.key}`;
          return (
            <div key={line.key} className="rounded-xl border bg-card">
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => setOpenKey(open ? null : line.key)}
                  className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground"
                >
                  <ChevronDown
                    aria-hidden
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !open && "-rotate-90")}
                  />
                  {open ? (
                    <span className="micro-label">Producto {index + 1}</span>
                  ) : (
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm font-medium", typed === "" && "text-muted-foreground")}>
                          {typed === "" ? "Sin producto" : typed}
                        </span>
                        {!complete && (
                          <span className="shrink-0 rounded-full bg-destructive-soft px-2 py-0.5 text-xs text-destructive">Incompleta</span>
                        )}
                      </span>
                      {summary.length > 0 && <span className="num block truncate text-xs text-muted-foreground">{summary.join(" · ")}</span>}
                    </span>
                  )}
                </button>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 text-destructive md:size-9"
                    aria-label={`Quitar producto ${index + 1}`}
                    title="Quitar producto"
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
              {/* Kept mounted while collapsed: the values live in the drafts and the inputs keep their own state. */}
              <div id={bodyId} hidden={!open} className="space-y-3 px-3 pb-3">
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
                    defaultValue={line.cost === "" ? undefined : costOf(line.cost)}
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
                      onChange={(e) => patch(line.key, { orderNumber: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          );
        })}
        {lines.length < MAX_LINES && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full md:h-9"
            onClick={addLine}
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
