"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, Field } from "@/components/app/action-form";
import { PesosInput } from "@/components/app/pesos-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { clientNames } from "@/modules/orders/domain/order-days";
import { formatDisplayDate, todayInBogota } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { createLoadsAction, updateLoadAction } from "../application/load-actions";
import { NOTES_MAX, REFERENCE_MAX } from "../application/load-schemas";
import { allocationErrors, compareAllocation, differenceText, type ProductAllocation } from "../domain/load-allocation";
import {
  allocationInputsOf,
  buildDrafts,
  compareByDelivery,
  draftsTotals,
  isBlockDraftComplete,
  orderParts,
  pendingSuppliersOf,
  serializeBlocks,
  type BlockDraft,
  type Drafts,
  type PendingSource,
  type ProductDraft,
} from "../domain/load-pending";
import { costOf, firstDuplicate } from "../domain/load-lines";
import { formatCop, type LoadRow } from "../domain/load-rules";

const FIELD = "h-10 md:h-9";

/**
 * Creates the loads of an order, one block per supplier still pending in it (each with its own SIESA,
 * supplier order, cost and products; they are saved together), or edits one load (`load`), which keeps
 * the orders it already took.
 */
export function LoadForm({
  load,
  orderId,
  plates,
  orders,
  kgPerBag,
  onDone,
  onCancel,
}: {
  /** The load being edited; without it the form creates the loads of `orderId`. */
  load?: LoadRow;
  orderId?: number;
  /** Plates of the registered fleet: the only ones that can be picked. */
  plates: readonly string[];
  /** Every order that is not annulled; the form takes the ones this load covers. */
  orders: readonly PendingSource[];
  kgPerBag: number;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  // The form mounts only while the side sheet is open, so "today" is read on the client at that moment.
  const [today] = useState(() => todayInBogota());
  // The stored plate stays selectable when its vehicle left the fleet.
  const plateOptions = load && !plates.includes(load.plate) ? [load.plate, ...plates] : plates;

  const covered: PendingSource[] = (() => {
    if (!load) return orders.filter((o) => o.id === orderId);
    const taken = new Set(load.lines.map((l) => l.orderId));
    return orders.filter((o) => taken.has(o.id)).sort(compareByDelivery);
  })();
  const [drafts, setDrafts] = useState<Drafts>(() =>
    buildDrafts(
      covered.flatMap((order) =>
        load ? [{ order, supplier: load.supplier }] : pendingSuppliersOf(order).map((supplier) => ({ order, supplier })),
      ),
      kgPerBag,
      load?.lines,
    ),
  );

  const allocationInputs = allocationInputsOf(drafts.blocks, covered, drafts.products, kgPerBag);
  const allocations = allocationInputs.flatMap((input) => compareAllocation(input).map((a) => ({ supplier: input.supplier, ...a })));
  const totals = draftsTotals(drafts);
  const newOrder = load ? undefined : covered[0];

  const patchBlock = (block: BlockDraft, change: Partial<BlockDraft>) =>
    setDrafts((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.orderId === block.orderId && b.supplier === block.supplier ? { ...b, ...change } : b)),
    }));
  const patchProduct = (key: number, tons: string) =>
    setDrafts((d) => ({ ...d, products: d.products.map((p) => (p.key === key ? { ...p, tons } : p)) }));

  return (
    <ActionForm
      action={(fd) => {
        if (drafts.blocks.length === 0) {
          return Promise.resolve({ ok: false as const, error: "Este pedido no tiene nada por cargar." });
        }
        // The inputs of the blocks are controlled and unnamed, so an incomplete block is reported here.
        const incomplete = drafts.blocks.find((b) => !isBlockDraftComplete(b, drafts.products));
        if (incomplete) {
          return Promise.resolve({
            ok: false as const,
            error: `Completa el SIESA, el pedido proveedor, el costo y las toneladas de ${load ? `el pedido #${incomplete.orderId}` : incomplete.supplier}.`,
          });
        }
        const repeated = firstDuplicate(drafts.blocks.map((b) => b.siesaNumber.trim()));
        if (repeated !== null) {
          return Promise.resolve({ ok: false as const, error: `El número SIESA ${repeated} está repetido en el cargue.` });
        }
        // The same rule the server enforces, so the loader sees what to fix before sending.
        const errors = allocationInputs.flatMap(allocationErrors);
        if (errors.length > 0) return Promise.resolve({ ok: false as const, error: errors.join("; ") });
        if (load) {
          fd.set("orders", serializeBlocks(drafts));
          return updateLoadAction(load.id, fd);
        }
        fd.set("orderId", String(orderId ?? ""));
        fd.set("blocks", serializeBlocks(drafts));
        return createLoadsAction(fd);
      }}
      submitLabel={load ? "Guardar cambios" : drafts.blocks.length > 1 ? "Registrar cargues" : "Registrar cargue"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha" htmlFor="load-date" required>
          <Input id="load-date" name="date" type="date" className={FIELD} defaultValue={load?.date ?? today} required />
        </Field>
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
      </div>
      {load && (
        <Field label="Proveedor" htmlFor="load-supplier">
          {/* Fixed: an edit keeps the supplier of its load. */}
          <Input id="load-supplier" className={FIELD} value={load.supplier} readOnly />
          <input type="hidden" name="supplier" value={load.supplier} />
        </Field>
      )}

      {newOrder && <OrderSummary order={newOrder} kgPerBag={kgPerBag} />}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{load ? "Pedidos del cargue" : "Proveedores del cargue"}</legend>
        {drafts.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este pedido no tiene nada por cargar.</p>
        ) : (
          <ul className="space-y-3">
            {drafts.blocks.map((block) => {
              const source = covered.find((o) => o.id === block.orderId);
              if (!source) return null;
              return (
                <Block
                  key={`${block.orderId}-${block.supplier}`}
                  order={source}
                  kgPerBag={kgPerBag}
                  editing={load !== undefined}
                  block={block}
                  products={drafts.products.filter((p) => p.orderId === block.orderId && p.supplier === block.supplier)}
                  allocations={allocations.find((a) => a.orderId === block.orderId && a.supplier === block.supplier)?.products ?? []}
                  onPatchBlock={(change) => patchBlock(block, change)}
                  onPatchProduct={patchProduct}
                />
              );
            })}
          </ul>
        )}
      </fieldset>

      {drafts.blocks.length > 0 && (
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {formatDecimal(totals.tons, 3)} t · {formatCop(totals.cost)}
        </p>
      )}

      <Field label="Observación" htmlFor="load-notes" hint="Opcional">
        <Textarea id="load-notes" name="notes" rows={3} maxLength={NOTES_MAX} defaultValue={load?.notes ?? ""} />
      </Field>
    </ActionForm>
  );
}

/** The order the new loads belong to, with the suppliers that already have a load. */
function OrderSummary({ order, kgPerBag }: { order: PendingSource; kgPerBag: number }) {
  const loaded = orderParts(order, kgPerBag).filter((p) => !p.pending);
  const names = clientNames(order).join(", ");
  return (
    <div className="space-y-0.5 rounded-xl border bg-muted/40 p-3 text-sm">
      <p className="flex items-baseline justify-between gap-3">
        <span className="num font-semibold">Pedido #{order.id}</span>
        <span className="num shrink-0 text-muted-foreground">Entrega {formatDisplayDate(order.deliveryDate)}</span>
      </p>
      <p className="truncate" title={names}>
        {names || "Sin clientes"}
      </p>
      {loaded.length > 0 && <p className="text-xs text-muted-foreground">{loaded.map((p) => `${p.supplier} ya cargado`).join(" · ")}</p>}
    </div>
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
 * One block of the form: its SIESA number, supplier order number and total cost, and each of its
 * products with the kilos ordered, whether the entered tons match, and the tons. A new load shows the
 * supplier as the heading; an edit shows the order (an old load can carry several).
 */
function Block({
  order,
  kgPerBag,
  editing,
  block,
  products,
  allocations,
  onPatchBlock,
  onPatchProduct,
}: {
  order: PendingSource;
  kgPerBag: number;
  editing: boolean;
  block: BlockDraft;
  products: readonly ProductDraft[];
  allocations: readonly ProductAllocation[];
  onPatchBlock: (change: Partial<BlockDraft>) => void;
  onPatchProduct: (key: number, tons: string) => void;
}) {
  const id = `${block.orderId}-${block.supplier}`;
  const part = orderParts(order, kgPerBag).find((p) => p.supplier === block.supplier);
  const names = clientNames({ lines: order.lines.filter((l) => l.supplier === block.supplier) }).join(", ");
  const heading: ReactNode = editing ? (
    <>
      <p className="flex items-baseline justify-between gap-3">
        <span className="num font-semibold">Pedido #{order.id}</span>
        <span className="num shrink-0 text-muted-foreground">Entrega {formatDisplayDate(order.deliveryDate)}</span>
      </p>
      <p className="truncate" title={names}>
        {names || "Sin clientes"}
      </p>
    </>
  ) : (
    <p className="flex items-baseline justify-between gap-3">
      <span className="font-semibold">{block.supplier}</span>
      {part && (
        <span className="num shrink-0 text-muted-foreground">
          {formatDecimal(part.bags, 0)} bultos · {formatDecimal(part.tons, 3)} t
        </span>
      )}
    </p>
  );
  return (
    <li>
      <section aria-label={editing ? `Pedido ${order.id}` : block.supplier} className="divide-y rounded-xl border bg-card">
        <div className="space-y-0.5 bg-muted/40 p-3 text-sm">{heading}</div>

        <div className="grid grid-cols-2 gap-3 p-3">
          <Field label="Número SIESA" htmlFor={`load-siesa-${id}`} required hint="No se puede repetir.">
            <Input
              id={`load-siesa-${id}`}
              className={`${FIELD} num`}
              value={block.siesaNumber}
              maxLength={REFERENCE_MAX}
              autoComplete="off"
              onChange={(e) => onPatchBlock({ siesaNumber: e.target.value })}
            />
          </Field>
          <Field label="Pedido proveedor" htmlFor={`load-order-${id}`} required>
            <Input
              id={`load-order-${id}`}
              className={`${FIELD} num`}
              value={block.orderNumber}
              maxLength={REFERENCE_MAX}
              autoComplete="off"
              onChange={(e) => onPatchBlock({ orderNumber: e.target.value })}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Costo total (COP)" htmlFor={`load-cost-${id}`} required>
              <PesosInput
                id={`load-cost-${id}`}
                name={`cost-${id}`}
                defaultValue={block.cost === "" ? undefined : costOf(block.cost)}
                onValueChange={(next) => onPatchBlock({ cost: next })}
              />
            </Field>
          </div>
        </div>

        {allocations.map((product) => {
          const line = products.find((p) => p.referenceId === product.referenceId);
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
              {line && (
                <Field label="Toneladas" htmlFor={`load-tons-${line.key}`} required>
                  <Input
                    id={`load-tons-${line.key}`}
                    inputMode="decimal"
                    className={`${FIELD} num`}
                    value={line.tons}
                    autoComplete="off"
                    onChange={(e) => onPatchProduct(line.key, e.target.value)}
                  />
                </Field>
              )}
            </div>
          );
        })}
      </section>
    </li>
  );
}
