"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ClientPicker, type ClientOption } from "@/modules/deliveries/ui/client-picker";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { createOrderAction, updateOrderAction } from "../application/order-actions";
import { MAX_LINES, NOTE_MAX, TIME_WINDOW_MAX } from "../application/order-schemas";
import { productLabel, type CatalogProduct } from "../domain/catalog";
import { bagsOf, isBlankRow, productRowError, serializeOrder, withTrailingRow, type ProductRow } from "../domain/order-draft";
import { bagsToKg, kgToTons, orderTotals, type OrderRow } from "../domain/order-rules";
import { ProductPicker } from "./product-picker";

const FIELD = "h-10 md:h-9";
const ROW_GRID = "grid grid-cols-[1fr_6rem_2.75rem] items-center gap-2 md:grid-cols-[1fr_6rem_2.25rem]";

/** The rows of an existing order, plus the empty one to type the next product in. */
function rowsOf(order: OrderRow | undefined): readonly ProductRow[] {
  const rows = (order?.lines ?? []).map((l, index) => ({
    key: index,
    referenceId: l.referenceId,
    legacyText: productLabel({ code: l.referenceCode, name: l.referenceName }),
    bags: String(l.bags),
  }));
  return withTrailingRow(rows, MAX_LINES);
}

/** Creates an order, or edits `order` (a pending one) when given. */
export function OrderForm({
  order,
  clients,
  references,
  kgPerBag,
  onDone,
  onCancel,
}: {
  order?: OrderRow;
  clients: readonly ClientOption[];
  /** The product catalog (every supplier): a row can only carry one of these. */
  references: readonly CatalogProduct[];
  kgPerBag: number;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // One client (and optionally one finca) for the whole order; the products are the rows.
  const [clientId, setClientId] = useState<number | null>(() => order?.lines[0]?.clientId ?? null);
  const [locationId, setLocationId] = useState(() => String(order?.lines[0]?.locationId ?? ""));
  const [rows, setRows] = useState<readonly ProductRow[]>(() => rowsOf(order));
  const inCatalog = new Set(references.map((p) => p.id));
  const locations = clients.find((c) => c.id === clientId)?.locations ?? [];

  const patch = (key: number, change: Partial<ProductRow>) =>
    setRows((all) =>
      withTrailingRow(
        all.map((r) => (r.key === key ? { ...r, ...change } : r)),
        MAX_LINES,
      ),
    );
  const remove = (key: number) =>
    setRows((all) =>
      withTrailingRow(
        all.filter((r) => r.key !== key),
        MAX_LINES,
      ),
    );
  const totals = orderTotals(
    rows.map((r) => ({ bags: bagsOf(r) })),
    kgPerBag,
  );

  return (
    <ActionForm
      action={(fd) => {
        if (clientId === null) return Promise.resolve({ ok: false as const, error: "Elige el cliente del pedido." });
        // A row stored with a legacy product (typed before the catalog) must be given a catalog one.
        const error = productRowError(rows, inCatalog);
        if (error) return Promise.resolve({ ok: false as const, error });
        fd.set("order", serializeOrder({ clientId, locationId, rows }));
        return order ? updateOrderAction(order.id, fd) : createOrderAction(fd);
      }}
      submitLabel={order ? "Guardar cambios" : "Registrar pedido"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de entrega" htmlFor="order-date" required>
          <Input id="order-date" name="deliveryDate" type="date" className={FIELD} defaultValue={order?.deliveryDate ?? today} required />
        </Field>
        <Field label="Ventana horaria" htmlFor="order-window" hint="Opcional. Ej.: 7–11 a.m.">
          <Input
            id="order-window"
            name="timeWindow"
            className={FIELD}
            defaultValue={order?.timeWindow ?? ""}
            maxLength={TIME_WINDOW_MAX}
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Nota" htmlFor="order-note" hint="Opcional">
        <Textarea id="order-note" name="note" rows={2} maxLength={NOTE_MAX} defaultValue={order?.note ?? ""} />
      </Field>

      <Field label="Cliente" htmlFor="order-client" required>
        <ClientPicker
          id="order-client"
          clients={clients}
          defaultClientId={clientId ?? undefined}
          // A new client brings its own fincas: the previous finca no longer applies.
          onChange={(id) => {
            setClientId(id);
            setLocationId("");
          }}
        />
      </Field>
      {locations.length > 0 && (
        <Field label="Finca" htmlFor="order-location" hint="Opcional">
          <NativeSelect id="order-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Sin finca</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Productos</legend>
        <div className={`${ROW_GRID} text-xs text-muted-foreground`} aria-hidden>
          <span>Referencia</span>
          <span>Bultos</span>
          <span />
        </div>
        {rows.map((row, index) => {
          const bags = bagsOf(row);
          const legacy = row.referenceId !== null && !inCatalog.has(row.referenceId);
          // A product already chosen in another row is not offered again.
          const taken = new Set(rows.filter((r) => r.key !== row.key && r.referenceId !== null).map((r) => r.referenceId));
          const available = references.filter((p) => !taken.has(p.id));
          return (
            <div key={row.key} className="space-y-1">
              <div className={ROW_GRID}>
                <div>
                  <Label htmlFor={`order-reference-${row.key}`} className="sr-only">
                    Referencia del producto {index + 1}
                  </Label>
                  <ProductPicker
                    id={`order-reference-${row.key}`}
                    products={available}
                    value={row.referenceId}
                    initialText={row.legacyText}
                    showSupplier
                    onChange={(referenceId) => patch(row.key, { referenceId, legacyText: "" })}
                  />
                </div>
                <div>
                  <Label htmlFor={`order-bags-${row.key}`} className="sr-only">
                    Bultos del producto {index + 1}
                  </Label>
                  <Input
                    id={`order-bags-${row.key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className={`${FIELD} num`}
                    value={row.bags}
                    onChange={(e) => patch(row.key, { bags: e.target.value })}
                  />
                </div>
                {isBlankRow(row) && index === rows.length - 1 ? (
                  <span aria-hidden />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive md:size-9"
                    aria-label={`Quitar producto ${index + 1}`}
                    title="Quitar producto"
                    onClick={() => remove(row.key)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
              {legacy && <p className="text-xs text-destructive">Esta referencia no está en el catálogo: elige una.</p>}
              {bags > 0 && (
                <p className="num text-xs text-muted-foreground">
                  {formatDecimal(bagsToKg(bags, kgPerBag), 2)} kg · {formatDecimal(kgToTons(bagsToKg(bags, kgPerBag)), 3)} t
                </p>
              )}
            </div>
          );
        })}
      </fieldset>

      <p className="num rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
        Total: {formatDecimal(totals.bags, 0)} bultos · {formatDecimal(totals.kg, 2)} kg · {formatDecimal(totals.tons, 3)} t
        <span className="block text-xs text-muted-foreground">Con {formatDecimal(kgPerBag, 2)} kg por bulto.</span>
      </p>
    </ActionForm>
  );
}
