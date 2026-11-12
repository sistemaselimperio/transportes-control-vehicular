"use client";

import { Eye, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { isExpensePending } from "../domain/expense";
import { formatNit } from "../domain/nit";
import type { ExpenseRow } from "../domain/petty-cash-rows";
import { ActionMenu, type ActionMenuItem } from "./action-menu";
import { AttachmentViewer, type ViewedAttachment } from "./attachment-viewer";
import { DuplicateBadge, ResponsibilityBadge, ReviewBadge, VehicleChip } from "./expense-badges";

const PENDING_HINT = "Falta NIT, empresa o tipo de responsabilidad";

type Handlers = {
  onEdit: (r: ExpenseRow) => void;
  onDelete: (r: ExpenseRow) => void;
  onView: (r: ExpenseRow) => void;
};

function rowMenu(row: ExpenseRow, { onEdit, onDelete, onView }: Handlers): ActionMenuItem[] {
  const items: ActionMenuItem[] = [{ label: "Editar", icon: Pencil, onSelect: () => onEdit(row) }];
  if (row.attachment) items.push({ label: "Ver adjunto", icon: Eye, onSelect: () => onView(row) });
  items.push({ label: "Eliminar", icon: Trash2, onSelect: () => onDelete(row), destructive: true });
  return items;
}

function ExpenseCard({ row, handlers }: { row: ExpenseRow; handlers: Handlers }) {
  const { onEdit } = handlers;
  const pending = isExpensePending(row);
  return (
    <li
      className={cn(
        "flex items-start rounded-2xl border bg-card shadow-soft",
        row.needsReview && "border-warn-foreground/30 bg-warn/20",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(row)}
        aria-label={`Editar gasto: ${row.detail}`}
        className="min-w-0 flex-1 space-y-2 rounded-2xl p-4 pr-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-[15px] leading-snug font-semibold break-words">{row.detail}</span>
          <span className="num shrink-0 text-lg leading-snug font-semibold">
            {row.value === null ? "—" : formatPrice(row.value)}
          </span>
        </span>
        {(row.vehicleLabel || row.company) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {row.vehicleLabel && <VehicleChip label={row.vehicleLabel} />}
            {row.company && <span className="min-w-0 truncate">{row.company}</span>}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <span
            className={cn("num", pending ? "font-bold text-destructive" : "text-muted-foreground")}
            title={pending ? PENDING_HINT : undefined}
          >
            NIT {row.nit ? formatNit(row.nit) : "pendiente"}
          </span>
          {row.efk && <span className="num text-muted-foreground">EFK {row.efk}</span>}
          {row.responsibilityType && <ResponsibilityBadge type={row.responsibilityType} />}
          {row.needsReview && <ReviewBadge />}
          {row.possibleDuplicate && <DuplicateBadge />}
          {row.attachment && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Paperclip className="size-3.5" aria-hidden />
              <span className="sr-only">Tiene adjunto</span>
            </span>
          )}
        </span>
      </button>
      <ActionMenu label={`Más acciones del gasto ${row.detail}`} items={rowMenu(row, handlers)} className="mt-2 mr-1" />
    </li>
  );
}

const HEADERS = ["Detalle", "Nº factura", "NIT", "Empresa", "EFK", "Responsabilidad", "Vehículo", "Valor"] as const;

/** The expenses of a ledger: a card per expense on phones, a clean table from `md`. */
export function ExpenseList({
  expenses,
  onEdit,
  onDelete,
}: {
  expenses: readonly ExpenseRow[];
  onEdit: (r: ExpenseRow) => void;
  onDelete: (r: ExpenseRow) => void;
}) {
  const [viewing, setViewing] = useState<ViewedAttachment | null>(null);
  const onView = (row: ExpenseRow) => row.attachment && setViewing({ expenseId: row.id, ...row.attachment });
  const handlers: Handlers = { onEdit, onDelete, onView };
  return (
    <>
      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
      <ul className="grid gap-3 md:hidden">
        {expenses.map((row) => (
          <ExpenseCard key={row.id} row={row} handlers={handlers} />
        ))}
      </ul>

      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Gastos de la planilla</caption>
          <thead>
            <tr className="border-b bg-muted/60 text-left">
              {HEADERS.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn("micro-label px-3 py-3 font-medium", i === HEADERS.length - 1 && "text-right")}
                >
                  {h}
                </th>
              ))}
              <th scope="col" className="w-px px-2">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.map((row) => {
              const pending = isExpensePending(row);
              return (
                <tr
                  key={row.id}
                  onClick={() => onEdit(row)}
                  className={cn("cursor-pointer align-top hover:bg-muted/50", row.needsReview && "bg-warn/20 hover:bg-warn/30")}
                >
                  <td className="max-w-72 px-3 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(row);
                      }}
                      className="rounded text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
                    >
                      {row.detail}
                    </button>
                    {(row.needsReview || row.possibleDuplicate) && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {row.needsReview && <ReviewBadge />}
                        {row.possibleDuplicate && <DuplicateBadge />}
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-3 whitespace-nowrap">{row.invoiceNumber}</td>
                  <td
                    className={cn("num px-3 py-3 whitespace-nowrap", pending && "font-bold text-destructive")}
                    title={pending ? PENDING_HINT : undefined}
                  >
                    {row.nit ? formatNit(row.nit) : pending ? "Pendiente" : ""}
                  </td>
                  <td className="px-3 py-3">{row.company}</td>
                  <td className="num px-3 py-3 whitespace-nowrap">{row.efk}</td>
                  <td className="px-3 py-3">
                    {row.responsibilityType && <ResponsibilityBadge type={row.responsibilityType} />}
                  </td>
                  <td className="px-3 py-3">{row.vehicleLabel && <VehicleChip label={row.vehicleLabel} />}</td>
                  <td className="num px-3 py-3 text-right font-semibold whitespace-nowrap">
                    {row.value === null ? "—" : formatPrice(row.value)}
                  </td>
                  <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      {row.attachment && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          aria-label={`Ver adjunto: ${row.attachment.name}`}
                          title="Ver adjunto"
                          onClick={() => onView(row)}
                        >
                          <Paperclip aria-hidden />
                        </Button>
                      )}
                      <ActionMenu label={`Más acciones del gasto ${row.detail}`} items={rowMenu(row, handlers)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
