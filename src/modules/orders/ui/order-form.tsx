"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ClientPicker, type ClientOption } from "@/modules/deliveries/ui/client-picker";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { searchKey } from "@/modules/shared/domain/search-key";
import { createOrderAction, updateOrderAction } from "../application/order-actions";
import { MAX_LINES, NOTE_MAX, REFERENCE_MAX, TIME_WINDOW_MAX } from "../application/order-schemas";
import { bagsToKg, kgToTons, orderTotals, type OrderRow } from "../domain/order-rules";

const FIELD = "h-10 md:h-9";

/** A line while it is being typed: everything is text until the form is sent. */
interface LineDraft {
  key: number;
  clientId: number | null;
  locationId: string;
  reference: string;
  bags: string;
}

const emptyLine = (key: number): LineDraft => ({ key, clientId: null, locationId: "", reference: "", bags: "" });

/** The bags of a draft: a positive whole number, or 0 while it is blank or invalid. */
const bagsOf = (draft: LineDraft): number => (/^\d{1,9}$/.test(draft.bags.trim()) ? Number(draft.bags) : 0);

/** The JSON the server action parses; invalid bags travel as null so the schema rejects them. */
function serializeLines(drafts: readonly LineDraft[]): string {
  return JSON.stringify(
    drafts.map((d) => ({
      clientId: d.clientId,
      locationId: d.locationId === "" ? null : Number(d.locationId),
      reference: d.reference,
      bags: /^\d{1,9}$/.test(d.bags.trim()) ? Number(d.bags) : null,
    })),
  );
}

function draftsOf(order: OrderRow | undefined): LineDraft[] {
  if (!order) return [emptyLine(0)];
  return order.lines.map((l, index) => ({
    key: index,
    clientId: l.clientId,
    locationId: l.locationId === null ? "" : String(l.locationId),
    reference: l.referenceName,
    bags: String(l.bags),
  }));
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
  /** The catalog of references typed before: suggestions, never a limit. */
  references: readonly string[];
  kgPerBag: number;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const listId = useId();
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  const [lines, setLines] = useState<LineDraft[]>(() => draftsOf(order));
  const knownKeys = new Set(references.map(searchKey));

  const patch = (key: number, change: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const totals = orderTotals(
    lines.map((l) => ({ bags: bagsOf(l) })),
    kgPerBag,
  );

  return (
    <ActionForm
      action={(fd) => {
        fd.set("lines", serializeLines(lines));
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

      <datalist id={listId}>
        {references.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Líneas del pedido</legend>
        {lines.map((line, index) => {
          const client = clients.find((c) => c.id === line.clientId);
          const locations = client?.locations ?? [];
          const bags = bagsOf(line);
          const typed = line.reference.trim();
          return (
            <div key={line.key} className="space-y-3 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="micro-label">Línea {index + 1}</p>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-my-1 size-11 text-destructive md:size-9"
                    aria-label={`Quitar línea ${index + 1}`}
                    title="Quitar línea"
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>
              <Field label="Cliente" htmlFor={`order-client-${line.key}`} required>
                <ClientPicker
                  id={`order-client-${line.key}`}
                  clients={clients}
                  defaultClientId={line.clientId ?? undefined}
                  // A new client brings its own fincas: the previous finca no longer applies.
                  onChange={(clientId) => patch(line.key, { clientId, locationId: "" })}
                />
              </Field>
              {locations.length > 0 && (
                <Field label="Finca" htmlFor={`order-location-${line.key}`} hint="Opcional">
                  <NativeSelect
                    id={`order-location-${line.key}`}
                    value={line.locationId}
                    onChange={(e) => patch(line.key, { locationId: e.target.value })}
                  >
                    <option value="">Sin finca</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field
                  label="Referencia"
                  htmlFor={`order-reference-${line.key}`}
                  required
                  hint={typed !== "" && !knownKeys.has(searchKey(typed)) ? "Referencia nueva: se creará al guardar." : undefined}
                >
                  <Input
                    id={`order-reference-${line.key}`}
                    list={listId}
                    className={FIELD}
                    value={line.reference}
                    maxLength={REFERENCE_MAX}
                    autoComplete="off"
                    onChange={(e) => patch(line.key, { reference: e.target.value })}
                  />
                </Field>
                <Field label="Bultos" htmlFor={`order-bags-${line.key}`} required>
                  <Input
                    id={`order-bags-${line.key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className={`${FIELD} num`}
                    value={line.bags}
                    onChange={(e) => patch(line.key, { bags: e.target.value })}
                  />
                </Field>
              </div>
              {bags > 0 && (
                <p className="num text-xs text-muted-foreground">
                  {formatDecimal(bagsToKg(bags, kgPerBag), 2)} kg · {formatDecimal(kgToTons(bagsToKg(bags, kgPerBag)), 3)} t
                </p>
              )}
            </div>
          );
        })}
        {lines.length < MAX_LINES && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full md:h-9"
            onClick={() => setLines((all) => [...all, emptyLine(Math.max(-1, ...all.map((l) => l.key)) + 1)])}
          >
            <Plus aria-hidden />
            Agregar línea
          </Button>
        )}
      </fieldset>

      <p className="num rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
        Total: {formatDecimal(totals.bags, 0)} bultos · {formatDecimal(totals.kg, 2)} kg · {formatDecimal(totals.tons, 3)} t
        <span className="block text-xs text-muted-foreground">Con {formatDecimal(kgPerBag, 2)} kg por bulto.</span>
      </p>
    </ActionForm>
  );
}
