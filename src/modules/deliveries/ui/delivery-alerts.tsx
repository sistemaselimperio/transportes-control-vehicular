import { formatNit } from "@/modules/petty-cash/domain/nit";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { ALERT_THRESHOLD_DAYS, type ClientAlert } from "../domain/delivery-rules";

/** "Alertas": clients whose last delivery is `ALERT_THRESHOLD_DAYS` days old or more, the most overdue first. */
export function DeliveryAlerts({ alerts }: { alerts: readonly ClientAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ningún cliente lleva {ALERT_THRESHOLD_DAYS} días o más sin recibir una entrega.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clientes cuya última entrega fue hace {ALERT_THRESHOLD_DAYS} días o más. Los clientes sin entregas no aparecen.
      </p>
      <ul className="grid gap-3 md:hidden">
        {alerts.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="min-w-0">
              <p className="font-medium">{a.name}</p>
              {a.nit && <p className="num text-sm text-muted-foreground">NIT {formatNit(a.nit)}</p>}
              <p className="num text-sm text-muted-foreground">Última entrega: {formatDisplayDate(a.lastDeliveryDate)}</p>
            </div>
            <span className="num shrink-0 rounded-[5px] bg-warn px-2 py-1 text-sm font-semibold text-warn-foreground">
              {a.daysSince} días
            </span>
          </li>
        ))}
      </ul>

      <div className="panel hidden md:block">
        <div className="plate-head">
          <span className="micro-label">{alerts.length} clientes sin entregas recientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                {["Cliente", "NIT", "Última entrega", "Días sin entrega"].map((h) => (
                  <th key={h} scope="col" className="micro-label px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {alerts.map((a) => (
                <tr key={a.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="num px-4 py-3">{a.nit ? formatNit(a.nit) : "—"}</td>
                  <td className="num px-4 py-3 whitespace-nowrap">{formatDisplayDate(a.lastDeliveryDate)}</td>
                  <td className="px-4 py-3">
                    <span className="num rounded-[5px] bg-warn px-2 py-1 font-semibold text-warn-foreground">
                      {a.daysSince} días
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
