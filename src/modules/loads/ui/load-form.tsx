"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { productLabel } from "@/modules/orders/domain/catalog";
import { clientNames } from "@/modules/orders/domain/order-days";
import { orderTotals, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDisplayDate, todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal, parseDecimal } from "@/modules/shared/domain/decimal";
import { createLoadAction, updateLoadAction } from "../application/load-actions";
import { NOTES_MAX, REFERENCE_MAX } from "../application/load-schemas";
import {
  allocationErrors,
  compareAllocation,
  differenceText,
  ordersForSupplier,
  type AllocationInput,
  type OrderAllocation,
  type ProductAllocation,
} from "../domain/load-allocation";
import {
  costOf,
  draftsTotals,
  isDraftComplete,
  reconcileDrafts,
  suggestLines,
  type LineDraft,
} from "../domain/load-lines";
import { formatCop, isLoadSupplier, LOAD_SUPPLIERS, type LoadRow, type LoadSupplier } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

const nextKey = (drafts: readonly LineDraft[]): number => Math.max(-1, ...drafts.map((d) => d.key)) + 1;

/** The JSON the server action parses: the order and product of each line, and the rest as typed text. */
const serializeLines = (drafts: readonly LineDraft[]): string =>
  JSON.stringify(
    drafts.map((d) => ({
      orderId: d.orderId,
      referenceId: d.referenceId,
      tons: d.tons,
      cost: d.cost,
      siesaNumber: d.siesaNumber,
      orderNumber: d.orderNumber,
    })),
  );

/** The products of the order that this supplier loads: what a load of the supplier takes of it. */
const supplierLinesOf = (order: OrderRow, supplier: LoadSupplier) => order.lines.filter((l) => l.supplier === supplier);

/** What the order asks of the supplier, as the allocation rule reads it. */
const toAllocationOrder = (order: OrderRow): AllocationInput["orders"][number] => ({
  id: order.id,
  lines: order.lines.map((l) => ({
    referenceId: l.referenceId,
    label: productLabel({ code: l.referenceCode, name: l.referenceName }),
    supplier: l.supplier,
    bags: l.bags,
  })),
});

const toAllocationLines = (drafts: readonly LineDraft[]): AllocationInput["lines"] =>
  drafts.flatMap((d) => (d.referenceId === null ? [] : [{ orderId: d.orderId, referenceId: d.referenceId, tons: parseDecimal(d.tons) ?? 0 }]));

/** Creates a load, or edits `load` when given. */
export function LoadForm({
  load,
  plates,
  orders,
  kgPerBag,
  presetOrderId = null,
  onDone,
  onCancel,
}: {
  load?: LoadRow;
  /** Plates of the registered fleet: the only ones that can be picked. */
  plates: readonly string[];
  /** Every order that is not annulled; the form offers, for the chosen supplier, the ones with products still to load. */
  orders: readonly OrderRow[];
  kgPerBag: number;
  /** An order checked from the start (the "Crear cargue" shortcut of the orders page). */
  presetOrderId?: number | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = load && !plates.includes(load.plate) ? [load.plate, ...plates] : plates;

  // A new load opened from an order's "Cargue" button is about that order only: no other order is offered.
  const preset = load || presetOrderId === null ? undefined : orders.find((o) => o.id === presetOrderId);
  /** The orders a load of `s` can take; this load's own part counts as available when editing. */
  const candidatesOf = (s: LoadSupplier | "") =>
    ordersForSupplier(orders, s === "" ? null : s, load?.id).filter((o) => preset === undefined || o.id === preset.id);
  const suggestionsFor = (s: LoadSupplier | "", ids: ReadonlySet<number>) =>
    suggestLines(
      candidatesOf(s)
        .filter((o) => ids.has(o.id))
        .map((o) => ({ id: o.id, lines: s === "" ? [] : supplierLinesOf(o, s) })),
      kgPerBag,
    );

  // A preset order that only one supplier still has to load also chooses the supplier.
  const [supplier, setSupplier] = useState<LoadSupplier | "">(
    load?.supplier ?? (preset && preset.pendingSuppliers.length === 1 ? (preset.pendingSuppliers[0] ?? "") : ""),
  );
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => {
    if (load) return new Set(load.orders.map((o) => o.id));
    return preset && supplier !== "" && candidatesOf(supplier).some((o) => o.id === preset.id) ? new Set([preset.id]) : new Set();
  });
  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (load) {
      return load.lines.map((l, key) => ({
        key,
        orderId: l.orderId,
        referenceId: l.referenceId,
        reference: l.referenceName === null ? "" : productLabel({ code: l.referenceCode, name: l.referenceName }),
        tons: String(l.tons),
        cost: String(l.cost),
        siesaNumber: l.siesaNumber,
        orderNumber: l.orderNumber,
        auto: false,
      }));
    }
    return reconcileDrafts([], suggestionsFor(supplier, checked), checked, 0);
  });

  const candidates = candidatesOf(supplier);
  const checkedOrders = candidates.filter((o) => checked.has(o.id));
  const allocationInput: AllocationInput | null =
    supplier === "" ? null : { supplier, kgPerBag, orders: checkedOrders.map(toAllocationOrder), lines: toAllocationLines(lines) };
  const allocations = allocationInput ? compareAllocation(allocationInput) : [];

  /** Applies a new set of checked orders: each checked order suggests its supplier products; what the user entered stays. */
  function applyChecked(s: LoadSupplier | "", next: ReadonlySet<number>, current: readonly LineDraft[]) {
    setChecked(next);
    const reconciled = reconcileDrafts(current, suggestionsFor(s, next), next, nextKey(current));
    setLines(reconciled);
  }

  function toggle(id: number, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    applyChecked(supplier, next, lines);
  }

  function changeSupplier(next: LoadSupplier | "") {
    setSupplier(next);
    // The checked orders and their lines belong to the previous supplier: start over, keeping the preset order.
    const available = candidatesOf(next);
    const first = preset && available.some((o) => o.id === preset.id) ? new Set([preset.id]) : new Set<number>();
    setChecked(first);
    const fresh = reconcileDrafts(
      [],
      suggestLines(
        available.filter((o) => first.has(o.id)).map((o) => ({ id: o.id, lines: next === "" ? [] : supplierLinesOf(o, next) })),
        kgPerBag,
      ),
      first,
      0,
    );
    setLines(fresh);
  }

  /** An edited line stops following its order. */
  const patch = (key: number, change: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change, auto: false } : l)));

  const totals = draftsTotals(lines);

  return (
    <ActionForm
      action={(fd) => {
        if (allocationInput === null || checkedOrders.length === 0) {
          return Promise.resolve({ ok: false as const, error: "Elige al menos un pedido." });
        }
        // The line inputs are controlled and unnamed, so an incomplete line is reported here by its order and product.
        const incomplete = lines.find((l) => !isDraftComplete(l));
        if (incomplete) {
          return Promise.resolve({ ok: false as const, error: `Completa los datos del pedido #${incomplete.orderId}: ${incomplete.reference || "producto"}.` });
        }
        // The same rule the server enforces, so the loader sees what to fix before sending.
        const errors = allocationErrors(allocationInput);
        if (errors.length > 0) return Promise.resolve({ ok: false as const, error: errors.join("; ") });
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
          <NativeSelect
            id="load-supplier"
            name="supplier"
            value={supplier}
            onChange={(e) => changeSupplier(isLoadSupplier(e.target.value) ? e.target.value : "")}
            required
          >
            <option value="" disabled>
              Elige un proveedor
            </option>
            {(preset ? LOAD_SUPPLIERS.filter((s) => preset.pendingSuppliers.includes(s)) : LOAD_SUPPLIERS).map((s) => (
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
        <legend className="text-sm font-medium">{preset ? "Pedido" : "Pedidos"}</legend>
        {supplier === "" ? (
          <p className="text-sm text-muted-foreground">Elige primero el proveedor.</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pedidos con productos de {supplier} por cargar.</p>
        ) : (
          <ul className="space-y-1.5">
            {candidates.map((o) => {
              // Only what this supplier loads of the order: its products, bags and weight.
              const mine = supplierLinesOf(o, supplier);
              const totalsOfSupplier = orderTotals(mine, kgPerBag);
              const names = clientNames(o).join(", ");
              const isChecked = checked.has(o.id);
              return (
                <li key={o.id} className="space-y-3">
                  <label
                    className={cn(
                      "flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm",
                      // The order a load was opened from is a fixed summary, not a choice.
                      preset ? "bg-muted/40" : "cursor-pointer bg-card has-checked:border-ring has-checked:bg-muted/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      hidden={preset !== undefined}
                      name="orderIds"
                      value={o.id}
                      checked={isChecked}
                      onChange={(e) => toggle(o.id, e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="num font-semibold">Pedido #{o.id}</span>
                        <span className="num shrink-0 text-muted-foreground">Entrega {formatDisplayDate(o.deliveryDate)}</span>
                      </span>
                      <span className="block truncate">{names}</span>
                      <span className="num block text-muted-foreground">
                        {formatDecimal(totalsOfSupplier.bags, 0)} bultos de {supplier} · {formatDecimal(totalsOfSupplier.tons, 3)} t
                        {o.partial && <span className="text-warn-foreground"> · Cargado parcial</span>}
                      </span>
                    </span>
                  </label>
                  {/* A checked order opens its products right under it, so it is never listed twice. */}
                  {isChecked && (
                    <OrderSection
                      order={o}
                      allocation={allocations.find((a) => a.orderId === o.id)}
                      lines={lines.filter((l) => l.orderId === o.id)}
                      onRemoveLine={(key) => setLines((all) => all.filter((l) => l.key !== key))}
                      onPatch={patch}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {checkedOrders.length > 0 && (
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {totals.count} {totals.count === 1 ? "línea" : "líneas"} · {formatDecimal(totals.tons, 3)} t · {formatCop(totals.cost)}
        </p>
      )}

      <Field label="Observación" htmlFor="load-notes" hint="Opcional">
        <Textarea id="load-notes" name="notes" rows={3} maxLength={NOTES_MAX} defaultValue={load?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}

/** Expected against entered kilos of a product: a green "Completo" when it matches to the kilo, the difference otherwise. */
function ProductBalance({ product }: { product: ProductAllocation }) {
  const ok = product.differenceKg === 0;
  return (
    <span
      aria-live="polite"
      className={cn(
        "num shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        ok ? "bg-ok text-ok-foreground" : "bg-destructive-soft text-danger-foreground",
      )}
    >
      {ok ? "Completo" : differenceText(product.differenceKg)}
    </span>
  );
}

/**
 * One checked order: each of its supplier products with the kilos ordered, whether the entered tons match,
 * and the fields of the line that carries it (tons, cost, SIESA and supplier order number).
 */
function OrderSection({
  order,
  allocation,
  lines,
  onRemoveLine,
  onPatch,
}: {
  order: OrderRow;
  allocation: OrderAllocation | undefined;
  lines: readonly LineDraft[];
  onRemoveLine: (key: number) => void;
  onPatch: (key: number, change: Partial<LineDraft>) => void;
}) {
  const expectedIds = new Set(allocation?.products.map((p) => p.referenceId));
  const stray = lines.filter((l) => l.referenceId === null || !expectedIds.has(l.referenceId));
  return (
    <section aria-label={`Productos del pedido ${order.id}`} className="divide-y rounded-xl border bg-card">
      {(allocation?.products ?? []).map((product) => {
        const productLines = lines.filter((l) => l.referenceId === product.referenceId);
        return (
          <div key={product.referenceId} className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{product.label}</p>
                <p className="num text-xs text-muted-foreground">
                  {formatDecimal(product.bags, 0)} bultos · {formatDecimal(product.expectedKg / 1000, 3)} t pedidas
                </p>
              </div>
              <ProductBalance product={product} />
            </div>
            {productLines.map((line, index) => (
              <LineFields
                key={line.key}
                line={line}
                title={productLines.length > 1 ? `Línea ${index + 1}` : null}
                onPatch={(change) => onPatch(line.key, change)}
              />
            ))}
          </div>
        );
      })}

      {stray.length > 0 && (
        <div className="space-y-3 p-3">
          <p className="text-xs text-danger-foreground">Estas líneas no son de un producto del pedido para este proveedor: quítalas.</p>
          {stray.map((line) => (
            <LineFields
              key={line.key}
              line={line}
              title={line.reference || "Sin producto"}
              onRemove={() => onRemoveLine(line.key)}
              onPatch={(change) => onPatch(line.key, change)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** The fields of one line: tons, cost, SIESA and supplier order number, always visible. */
function LineFields({
  line,
  title,
  onRemove,
  onPatch,
}: {
  line: LineDraft;
  /** Shown only when a product has more than one line, or for a line that must be removed. */
  title: string | null;
  onRemove?: () => void;
  onPatch: (change: Partial<LineDraft>) => void;
}) {
  return (
    <div className="space-y-3">
      {title !== null && (
        <div className="flex items-center justify-between gap-2">
          <span className="micro-label">{title}</span>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-destructive md:size-9"
              aria-label={`Quitar ${title}`}
              title="Quitar línea"
              onClick={onRemove}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Toneladas" htmlFor={`load-tons-${line.key}`} required>
          <Input
            id={`load-tons-${line.key}`}
            inputMode="decimal"
            className={`${FIELD} num`}
            value={line.tons}
            autoComplete="off"
            onChange={(e) => onPatch({ tons: e.target.value })}
          />
        </Field>
        <Field label="Costo (COP)" htmlFor={`load-cost-${line.key}`} required>
          <PesosInput
            id={`load-cost-${line.key}`}
            name={`cost-${line.key}`}
            defaultValue={line.cost === "" ? undefined : costOf(line.cost)}
            onValueChange={(next) => onPatch({ cost: next })}
          />
        </Field>
        <Field label="Número SIESA" htmlFor={`load-siesa-${line.key}`} required hint="No se puede repetir.">
          <Input
            id={`load-siesa-${line.key}`}
            className={`${FIELD} num`}
            value={line.siesaNumber}
            maxLength={REFERENCE_MAX}
            autoComplete="off"
            onChange={(e) => onPatch({ siesaNumber: e.target.value })}
          />
        </Field>
        <Field label="Pedido proveedor" htmlFor={`load-order-${line.key}`} required>
          <Input
            id={`load-order-${line.key}`}
            className={`${FIELD} num`}
            value={line.orderNumber}
            maxLength={REFERENCE_MAX}
            autoComplete="off"
            onChange={(e) => onPatch({ orderNumber: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
