import { ChevronRight } from "lucide-react";
import { PlateText } from "@/components/app/plate-text";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { SummaryVehicle, SummarySupplier } from "../domain/load-summary";
import { formatCop } from "../domain/load-rules";

const HEADERS = ["Peso (kg)", "Valor", "SIESA", "Pedido"] as const;

/** One plate of a day: a collapsible row with its totals that opens the table of its SIESA. */
function VehicleDetails({ vehicle: v }: { vehicle: SummaryVehicle }) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/70 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="plate font-medium">
          <PlateText plate={v.plate} />
        </span>
        <span className="num ml-auto text-right text-xs text-muted-foreground">
          {v.rows.length} SIESA · {formatDecimal(v.kg, 0)} kg · {formatCop(v.cost)}
        </span>
      </summary>
      <div className="overflow-x-auto pb-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y">
              {HEADERS.map((h) => (
                <th key={h} scope="col" className="micro-label px-4 py-2 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((row) => (
              <tr key={`${row.loadId}-${row.siesaNumber}-${row.orderNumber}`} className="hover:bg-muted/50">
                <td className="num whitespace-nowrap px-4 py-2 text-right">{formatDecimal(row.kg, 0)}</td>
                <td className="num whitespace-nowrap px-4 py-2 text-right">{formatCop(row.cost)}</td>
                <td className="num whitespace-nowrap px-4 py-2 text-right">{row.siesaNumber}</td>
                <td className="num whitespace-nowrap px-4 py-2 text-right">{row.orderNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Read-only summary of the loads, laid out like the notebook: per supplier and day, one collapsible entry per plate with kilos, value, SIESA and supplier order. */
export function LoadSummary({ suppliers }: { suppliers: readonly SummarySupplier[] }) {
  if (suppliers.length === 0) return <p className="text-sm text-muted-foreground">No hay cargues para este filtro.</p>;

  return (
    <div className="space-y-5">
      {suppliers.map((s) => (
        <section key={s.supplier} className="panel" aria-labelledby={`summary-${s.supplier}`}>
          <h2 id={`summary-${s.supplier}`} className="border-b bg-muted/60 px-4 py-3 text-sm font-semibold">
            {s.supplier}
          </h2>
          {s.days.map((day) => (
            <div key={day.date} className="border-b last:border-b-0">
              <h3 className="num bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">{formatDisplayDate(day.date)}</h3>
              <div className="divide-y">
                {day.vehicles.map((v) => (
                  <VehicleDetails key={v.plate} vehicle={v} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
