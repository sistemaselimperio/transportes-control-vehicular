import Link from "next/link";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { eventPrice, summarizeEvent, type TireEventRow } from "../domain/tire-events";
import { positionLabel } from "../domain/tire-positions";

/**
 * A trailer's tire events by position, read-only (the Bitácora lists them next to the old tire
 * changes). They are registered, edited and deleted in the trailer's file, which this links to.
 */
export function TireEventList({ plate, events }: { plate: string; events: readonly TireEventRow[] }) {
  if (events.length === 0) return null;
  return (
    <section aria-label="Llantas por posición" className="mt-6 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold">Llantas por posición</h3>
        <Link
          href={`/flota/${encodeURIComponent(plate)}`}
          className="text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-4 transition-colors duration-150 hover:text-foreground"
        >
          Editar en la ficha del remolque
        </Link>
      </div>
      <ul className="border-t">
        {events.map((event) => {
          const summary = summarizeEvent(event, event.position);
          const price = eventPrice(event);
          const provider = event.type === "CHANGE" || event.type === "REPAIR" ? event.provider : null;
          const detail = [summary.detail, provider, event.type === "REPAIR" ? null : event.notes].filter(Boolean).join(" · ");
          return (
            <li key={event.id} className="flex items-start justify-between gap-3 border-b py-2.5 text-sm">
              <div className="min-w-0">
                <p className="flex flex-wrap gap-x-3">
                  <span className="num font-medium">{formatDisplayDate(event.date)}</span>
                  <span className="font-medium">{summary.title}</span>
                  <span className="text-muted-foreground">{positionLabel(event.position)}</span>
                </p>
                {detail && <p className="break-words text-muted-foreground">{detail}</p>}
              </div>
              {price !== null && <span className="num shrink-0 font-medium">{formatPrice(price)}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
