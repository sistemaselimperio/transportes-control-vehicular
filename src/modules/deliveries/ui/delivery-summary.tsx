"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBags, formatKg, formatTons } from "../domain/delivery-format";
import { filterDeliveries, summarizeByDestination, totalsOf, type DeliveryRow } from "../domain/delivery-rules";

/** "Resumen": per destination, how many deliveries, bags, kilograms and tons in a date range (this month by default). */
export function DeliverySummary({ rows, today }: { rows: readonly DeliveryRow[]; today: string }) {
  const [from, setFrom] = useState<string | null>(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState<string | null>(today);

  const inRange = useMemo(
    () => filterDeliveries(rows, { query: "", destinationId: null, shift: null, from, to }),
    [rows, from, to],
  );
  const summary = useMemo(() => summarizeByDestination(inRange), [inRange]);
  const total = useMemo(() => totalsOf(inRange), [inRange]);

  return (
    <div className="space-y-4">
      <div className="grid max-w-md grid-cols-2 gap-3">
        <div>
          <Label htmlFor="summary-from" className="mb-1 block text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="summary-from"
            type="date"
            className="h-11 md:h-9"
            value={from ?? ""}
            max={to ?? undefined}
            onChange={(e) => setFrom(e.target.value || null)}
          />
        </div>
        <div>
          <Label htmlFor="summary-to" className="mb-1 block text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="summary-to"
            type="date"
            className="h-11 md:h-9"
            value={to ?? ""}
            min={from ?? undefined}
            onChange={(e) => setTo(e.target.value || null)}
          />
        </div>
      </div>

      {summary.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay entregas en este rango.</p>
      ) : (
        <div className="panel">
          <div className="plate-head">
            <span className="micro-label">{summary.length} destinos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b">
                  <th scope="col" className="micro-label px-4 py-3 font-medium">
                    Destino
                  </th>
                  {["Entregas", "Bultos", "Kg", "Toneladas"].map((h) => (
                    <th key={h} scope="col" className="micro-label px-4 py-3 text-right font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.map((s) => (
                  <tr key={s.destinationId} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{s.destinationName}</td>
                    <td className="num px-4 py-3 text-right">{s.count}</td>
                    <td className="num px-4 py-3 text-right">{formatBags(s.quantity)}</td>
                    <td className="num px-4 py-3 text-right">{formatKg(s.weightKg)}</td>
                    <td className="num px-4 py-3 text-right">{formatTons(s.weightKg)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <th scope="row" className="px-4 py-3 text-left">
                    Total
                  </th>
                  <td className="num px-4 py-3 text-right">{total.count}</td>
                  <td className="num px-4 py-3 text-right">{formatBags(total.quantity)}</td>
                  <td className="num px-4 py-3 text-right">{formatKg(total.weightKg)}</td>
                  <td className="num px-4 py-3 text-right">{formatTons(total.weightKg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
