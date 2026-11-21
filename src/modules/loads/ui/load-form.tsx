"use client";

import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { orderTotals, tonsDifference, type OrderRow } from "@/modules/orders/domain/order-rules";
import { formatDisplayDate, todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal, parseDecimal } from "@/modules/shared/domain/decimal";
import { createLoadAction, updateLoadAction } from "../application/load-actions";
import { NOTES_MAX, REFERENCE_MAX } from "../application/load-schemas";
import { LOAD_SUPPLIERS, type LoadRow } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

/** "+1,5", "-0,5" or "0": a difference with its sign. */
const formatSigned = (value: number): string => `${value > 0 ? "+" : ""}${formatDecimal(value, 3)}`;

/** Tons of the checked orders as the text the tons field takes ("12.8"). */
const tonsText = (tons: number): string => String(Math.round(tons * 1000) / 1000);

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
  /** Pending orders, plus those already linked to a load; only the pending ones and this load's own are offered. */
  orders: readonly OrderRow[];
  kgPerBag: number;
  /** A pending order checked from the start (the "Crear cargue" shortcut of the orders page). */
  presetOrderId?: number | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = load && !plates.includes(load.plate) ? [load.plate, ...plates] : plates;
  const available = orders.filter((o) => o.status === "pendiente" || (load !== undefined && o.loadId === load.id));
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => {
    if (load) return new Set(load.orders.map((o) => o.id));
    return presetOrderId !== null && available.some((o) => o.id === presetOrderId) ? new Set([presetOrderId]) : new Set();
  });
  const tonsOfChecked = (ids: ReadonlySet<number>) =>
    orderTotals(available.filter((o) => ids.has(o.id)).flatMap((o) => o.lines), kgPerBag).tons;
  const [tons, setTons] = useState(() => (load ? String(load.tons) : checked.size > 0 ? tonsText(tonsOfChecked(checked)) : ""));

  const ordersTons = tonsOfChecked(checked);
  const enteredTons = parseDecimal(tons);

  function toggle(id: number, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    setChecked(next);
    // Checking orders prefills the tons with what they add up to; the field stays editable.
    if (next.size > 0) setTons(tonsText(tonsOfChecked(next)));
  }

  return (
    <ActionForm
      action={(fd) => (load ? updateLoadAction(load.id, fd) : createLoadAction(fd))}
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
      <div className="grid grid-cols-2 gap-3">
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
        <Field label="Toneladas" htmlFor="load-tons" required>
          <Input
            id="load-tons"
            name="tons"
            inputMode="decimal"
            className={`${FIELD} num`}
            value={tons}
            onChange={(e) => setTons(e.target.value)}
            autoComplete="off"
            required
          />
        </Field>
      </div>
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
        {checked.size > 0 && (
          <p className="num text-xs text-muted-foreground" aria-live="polite">
            Pedidos: {formatDecimal(ordersTons, 3)} t
            {enteredTons !== null &&
              ` · diferencia con las toneladas del cargue: ${formatSigned(tonsDifference(enteredTons, ordersTons))} t`}
          </p>
        )}
      </fieldset>
      <Field label="Costo (COP)" htmlFor="load-cost" required>
        <PesosInput id="load-cost" name="cost" defaultValue={load?.cost} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número SIESA" htmlFor="load-siesa" required hint="No se puede repetir.">
          <Input
            id="load-siesa"
            name="siesaNumber"
            className={`${FIELD} num`}
            defaultValue={load?.siesaNumber ?? ""}
            maxLength={REFERENCE_MAX}
            autoComplete="off"
            required
          />
        </Field>
        <Field label="Pedido proveedor" htmlFor="load-order" required>
          <Input
            id="load-order"
            name="orderNumber"
            className={`${FIELD} num`}
            defaultValue={load?.orderNumber ?? ""}
            maxLength={REFERENCE_MAX}
            autoComplete="off"
            required
          />
        </Field>
      </div>
      <Field label="Observación" htmlFor="load-notes" hint="Opcional">
        <Textarea id="load-notes" name="notes" rows={3} maxLength={NOTES_MAX} defaultValue={load?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
