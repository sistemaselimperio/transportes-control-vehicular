import { PlateText } from "@/components/app/plate-text";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import type { SummarySupplier } from "../domain/load-summary";
import { formatCop } from "../domain/load-rules";

const HEADERS = ["Peso (kg)", "Valor", "SIESA", "Pedido"] as const;

/** Read-only summary of the loads, laid out like the notebook: plate, kilos, value, SIESA and supplier order. */
export function LoadSummary({ suppliers }: { suppliers: readonly SummarySupplier[] }) {
  if (suppliers.length === 0) return <p className="text-sm text-muted-foreground">No hay cargues para este filtro.</p>;

  return (
    <div className="space-y-5">
      {suppliers.map((s) => (
        <section key={s.supplier} className="panel" aria-labelledby={`summary-${s.supplier}`}>
          <h2 id={`summary-${s.supplier}`} className="border-b bg-muted/60 px-4 py-3 text-sm font-semibold">
            {s.supplier}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b">
                  <th scope="col" className="micro-label px-4 py-3 font-medium">
                    Placa
                  </th>
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="micro-label px-4 py-3 text-right font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {s.days.map((day) => (
                <tbody key={day.date} className="border-b last:border-b-0">
                  <tr className="bg-muted/30">
                    <th scope="colgroup" colSpan={HEADERS.length + 1} className="num px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      {formatDisplayDate(day.date)}
                    </th>
                  </tr>
                  {day.loads.flatMap((load) =>
                    load.rows.map((row, i) => (
                      <tr key={`${load.loadId}-${row.siesaNumber}-${row.orderNumber}`} className={i === 0 ? "border-t hover:bg-muted/50" : "hover:bg-muted/50"}>
                        <td className="whitespace-nowrap px-4 py-2 font-medium">
                          {i === 0 && (
                            <span className="plate">
                              <PlateText plate={load.plate} />
                            </span>
                          )}
                        </td>
                        <td className="num whitespace-nowrap px-4 py-2 text-right">{formatDecimal(row.kg, 0)}</td>
                        <td className="num whitespace-nowrap px-4 py-2 text-right">{formatCop(row.cost)}</td>
                        <td className="num whitespace-nowrap px-4 py-2 text-right">{row.siesaNumber}</td>
                        <td className="num whitespace-nowrap px-4 py-2 text-right">{row.orderNumber}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
