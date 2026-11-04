import { formatTripDateTime } from "../domain/trip-datetime";
import type { TripRow } from "../domain/trip-row";
import { TripStatusBadge } from "./trip-status-badge";

const TH = "micro-label px-4 py-3 font-medium";
const TD = "px-4 py-3";

/**
 * Latest trips of one vehicle for its file (read-only); the caller wraps it in the file's section.
 * From `md` a table with headers, like the Bitácora lists; ruled lines on phones.
 * The link to the full list sits next to the Historial tabs.
 */
export function VehicleTripsList({ rows }: { rows: readonly TripRow[] }) {
  if (rows.length === 0) {
    return <p className="border-b py-2.5 text-sm text-muted-foreground">Sin viajes registrados para este vehículo.</p>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto border-b md:block">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th scope="col" className={TH}>Fecha inicio</th>
              <th scope="col" className={TH}>Destino</th>
              <th scope="col" className={TH}>Área</th>
              <th scope="col" className={TH}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/50">
                <td className={`${TD} num whitespace-nowrap`}>{formatTripDateTime(r.startAt)}</td>
                <td className={`${TD} font-medium`}>{r.destination}</td>
                <td className={`${TD} text-muted-foreground`}>{r.area}</td>
                <td className={TD}>
                  <TripStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 border-b py-2 text-sm">
            <span className="num whitespace-nowrap">{formatTripDateTime(r.startAt)}</span>
            <span className="min-w-0 flex-1 basis-40 truncate font-medium">{r.destination}</span>
            <span className="text-muted-foreground">{r.area}</span>
            <TripStatusBadge status={r.status} />
          </li>
        ))}
      </ul>
    </>
  );
}
