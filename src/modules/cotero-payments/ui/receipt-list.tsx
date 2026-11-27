"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { PlateText } from "@/components/app/plate-text";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { formatVehiclePlate } from "../domain/plates";
import type { ReceiptRow } from "../domain/receipt-rules";
import { MismatchBadge, ReceiptStatusBadge } from "./badges";
import { formatCop } from "./format";

/** One card per receipt: number, day, cotero, plate, tons and the written amount, with its state. */
export function ReceiptList({
  rows,
  onEdit,
  onDelete,
}: {
  rows: readonly ReceiptRow[];
  onEdit: (row: ReceiptRow) => void;
  onDelete: (row: ReceiptRow) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No hay recibos para este filtro.</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((r) => (
        <li key={r.id} className="panel">
          <div className="flex items-start justify-between gap-2 border-b bg-muted/60 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="num font-semibold">{r.receiptNumber}</span>
                <span className="plate">
                  <PlateText plate={formatVehiclePlate(r.vehiclePlate)} />
                </span>
                {r.trailerPlate && (
                  <span className="plate">
                    <PlateText plate={formatVehiclePlate(r.trailerPlate)} />
                  </span>
                )}
              </div>
              <p className="num text-sm text-muted-foreground">
                {formatDisplayDate(r.date)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <ReceiptStatusBadge status={r.status} />
              {r.settlementNumber !== null && <span className="num text-xs text-muted-foreground">Liq. {r.settlementNumber}</span>}
            </div>
          </div>

          <div className="space-y-1.5 px-4 py-3 text-sm">
            <p className="font-medium">
              {r.coteroName}
              {r.coteroDocument && <span className="num font-normal text-muted-foreground"> · C.C. {r.coteroDocument}</span>}
            </p>
            {(r.destination || r.driverName) && (
              <p className="text-muted-foreground">
                {r.destination}
                {r.destination && r.driverName ? " · " : ""}
                {r.driverName && `Conductor ${r.driverName}`}
              </p>
            )}
            {r.remissions.length > 0 && <p className="num text-xs text-muted-foreground">Remisión {r.remissions.join(" ")}</p>}
            <p className="num flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-semibold">
              <span>{formatDecimal(r.tons, 3)} t</span>
              <span>{formatCop(r.amount)}</span>
              {r.amountMismatch && <MismatchBadge />}
            </p>
            {r.amountMismatch && r.expectedAmount !== null && r.tariffPerTon !== null && (
              <p className="num text-xs text-muted-foreground">
                Según tarifa ({formatCop(r.tariffPerTon)}/t): {formatCop(r.expectedAmount)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
            {r.filePath ? (
              <a
                href={`/api/pagos-coteros/recibos/${r.id}/archivo`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm text-brand outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 md:h-9"
              >
                <ExternalLink className="size-4" aria-hidden />
                Ver original{r.pageNumber ? ` (hoja ${r.pageNumber})` : ""}
              </a>
            ) : (
              <span className="px-2.5 text-xs text-muted-foreground">Sin archivo</span>
            )}
            {r.status === "pending" && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`Editar recibo ${r.receiptNumber}`} title="Editar" onClick={() => onEdit(r)}>
                  <Pencil aria-hidden />
                </Button>
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
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
