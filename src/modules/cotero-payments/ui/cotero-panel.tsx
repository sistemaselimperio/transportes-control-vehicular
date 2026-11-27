"use client";

import { ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { PlateText } from "@/components/app/plate-text";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { CoteroSummary } from "../domain/cotero-summary";
import { formatVehiclePlate } from "../domain/plates";
import type { ReceiptRow } from "../domain/receipt-rules";
import { MismatchBadge, ReceiptStatusBadge } from "./badges";
import { formatCop } from "./format";

const CELL = "max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-3 md:whitespace-nowrap md:px-3 md:py-2.5 md:align-middle";
const LABEL = "text-xs text-muted-foreground md:hidden";

function Stat({ title, count, tons, amount }: { title: string; count: number; tons: number; amount: number }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="num text-lg font-semibold">{formatCop(amount)}</p>
      <p className="num text-sm text-muted-foreground">
        {count} {count === 1 ? "recibo" : "recibos"} · {formatDecimal(tons, 3)} t
      </p>
    </div>
  );
}

function ReceiptTableRow({ r, onEdit, onDelete }: { r: ReceiptRow; onEdit: (row: ReceiptRow) => void; onDelete: (row: ReceiptRow) => void }) {
  const original = `Ver original${r.pageNumber ? ` (hoja ${r.pageNumber})` : ""}`;
  return (
    <tr className="max-md:grid max-md:gap-1.5 max-md:rounded-xl max-md:border max-md:bg-card max-md:p-3 md:border-b md:last:border-b-0">
      <td className={`${CELL} num font-semibold`}>
        <span className={LABEL}>N.º</span>
        {r.receiptNumber}
      </td>
      <td className={`${CELL} num`}>
        <span className={LABEL}>Fecha</span>
        {formatDisplayDate(r.date)}
      </td>
      <td className={CELL}>
        <span className={LABEL}>Placa</span>
        <span className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-start md:gap-1">
          <span className="plate">
            <PlateText plate={formatVehiclePlate(r.vehiclePlate)} />
          </span>
          {r.trailerPlate && (
            <span className="plate">
              <PlateText plate={formatVehiclePlate(r.trailerPlate)} />
            </span>
          )}
        </span>
      </td>
      <td className={`${CELL} num md:text-right`}>
        <span className={LABEL}>Toneladas</span>
        {formatDecimal(r.tons, 3)} t
      </td>
      <td className={`${CELL} num md:text-right`}>
        <span className={LABEL}>Valor</span>
        <span className="flex items-center justify-end gap-1.5 font-semibold">
          {formatCop(r.amount)}
          {r.amountMismatch && <MismatchBadge />}
        </span>
      </td>
      <td className={CELL}>
        <span className={LABEL}>Estado</span>
        <span className="flex flex-wrap items-center gap-1.5 md:flex-nowrap">
          <ReceiptStatusBadge status={r.status} />
          {r.settlementNumber !== null && <span className="num text-xs text-muted-foreground">Liq. {r.settlementNumber}</span>}
        </span>
      </td>
      {/* A table cell, not a flex box, so it stretches to the row and its content centers vertically. */}
      <td className="max-md:border-t max-md:pt-1.5 md:px-2 md:py-1 md:align-middle">
        <div className="flex items-center justify-between gap-1 md:justify-end md:whitespace-nowrap">
          {r.filePath ? (
            <a
              href={`/api/pagos-coteros/recibos/${r.id}/archivo`}
              target="_blank"
              rel="noreferrer"
              aria-label={original}
              title={original}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm text-brand outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9 md:min-w-9"
            >
              <ExternalLink className="size-4" aria-hidden />
              {r.pageNumber && (
                <span className="num" aria-hidden>
                  Hoja {r.pageNumber}
                </span>
              )}
            </a>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">Sin archivo</span>
          )}
          <span className="flex items-center gap-1">
            {r.status === "pending" && (
              <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`Editar recibo ${r.receiptNumber}`} title="Editar" onClick={() => onEdit(r)}>
                <Pencil aria-hidden />
              </Button>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="size-11 text-destructive md:size-9"
                aria-label={`Eliminar recibo ${r.receiptNumber}`}
                title="Eliminar"
                onClick={() => onDelete(r)}
              >
                <Trash2 aria-hidden />
              </Button>
          </span>
        </div>
      </td>
    </tr>
  );
}

/** Side sheet with one cotero's totals and receipts (the ones that match the page's filters). */
export function CoteroPanel({
  cotero,
  onClose,
  onEdit,
  onDelete,
  onSettlements,
}: {
  cotero: CoteroSummary | undefined;
  onClose: () => void;
  onEdit: (row: ReceiptRow) => void;
  onDelete: (row: ReceiptRow) => void;
  onSettlements: (cotero: CoteroSummary) => void;
}) {
  return (
    <SlideOver
      open={cotero !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={cotero?.name ?? "Cotero"}
      description={cotero?.document ? `C.C. ${cotero.document}` : undefined}
      wide="xl"
    >
      {cotero && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat title="Pendiente por liquidar" {...cotero.pending} />
            <Stat title="Total" {...cotero.all} />
          </div>

          <Button variant="outline" className="h-11 px-4 md:h-10" onClick={() => onSettlements(cotero)}>
            <FileText aria-hidden />
            Ver liquidaciones
          </Button>

          <table className="w-full text-sm max-md:block">
            <caption className="sr-only">Recibos de {cotero.name}</caption>
            <thead className="max-md:hidden">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-medium">N.º</th>
                <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-3 py-2 font-medium">Placa</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Toneladas</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="max-md:grid max-md:gap-2">
              {cotero.receipts.map((r) => (
                <ReceiptTableRow key={r.id} r={r} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SlideOver>
  );
}
