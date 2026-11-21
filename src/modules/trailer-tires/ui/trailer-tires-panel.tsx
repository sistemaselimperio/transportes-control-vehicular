"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NoticeToast, useNotice } from "@/modules/logbook/ui/notice";
import { RowActions } from "@/modules/logbook/ui/logbook-lists";
import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate, type IsoDate } from "@/modules/shared/domain/dates";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import { deleteTireEventAction } from "../application/tire-event-actions";
import {
  currentPositionState,
  eventPrice,
  eventsOfPosition,
  summarizeEvent,
  type TireEventRow,
} from "../domain/tire-events";
import { AXLES, positionLabel, positionsOfAxle, type TirePosition, type TirePositionInfo } from "../domain/tire-positions";
import { TireEventForm } from "./tire-event-form";

type Mode = { kind: "history" } | { kind: "create" } | { kind: "edit"; event: TireEventRow };

const SIDE_TITLES = { I: "Izquierda", D: "Derecha" } as const;
const SLOT_SHORT = { INT: "Interior", EXT: "Exterior" } as const;

/** One position of the diagram: its latest event, or "Sin registro". */
function PositionCell({
  info,
  events,
  onSelect,
}: {
  info: TirePositionInfo;
  events: readonly TireEventRow[];
  onSelect: () => void;
}) {
  const latest = currentPositionState(events, info.code);
  const summary = latest ? summarizeEvent(latest, info.code) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${info.label}: ${summary ? `${summary.title}, ${formatDisplayDate(latest!.date)}` : "sin registro"}`}
      className={cn(
        "flex min-h-20 min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.99]",
        latest ? "bg-card" : "border-dashed bg-muted/30",
      )}
    >
      <span className="micro-label">{SLOT_SHORT[info.slot]}</span>
      {summary && latest ? (
        <>
          <span className="w-full truncate text-sm font-medium">{summary.title}</span>
          <span className="num text-xs text-muted-foreground">{formatDisplayDate(latest.date)}</span>
          {summary.detail && <span className="w-full truncate text-xs text-muted-foreground">{summary.detail}</span>}
        </>
      ) : (
        <span className="text-sm text-muted-foreground">Sin registro</span>
      )}
    </button>
  );
}

/** One event in a position's history, with its edit and delete buttons for who may change it. */
function HistoryItem({
  event,
  position,
  plate,
  canEdit,
  onEdit,
  onResult,
}: {
  event: TireEventRow;
  position: TirePosition;
  plate: string;
  canEdit: boolean;
  onEdit: () => void;
  onResult: (result: ActionResult) => void;
}) {
  const summary = summarizeEvent(event, position);
  const price = eventPrice(event);
  const provider = event.type === "CHANGE" || event.type === "REPAIR" ? event.provider : null;
  const detail = [summary.detail, provider, event.type === "CHANGE" ? event.notes : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start justify-between gap-2 border-b py-3 text-sm">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap gap-x-3">
          <span className="num font-medium">{formatDisplayDate(event.date)}</span>
          <span className="font-medium">{summary.title}</span>
        </p>
        {detail && <p className="break-words text-muted-foreground">{detail}</p>}
        {event.type !== "CHANGE" && event.type !== "REPAIR" && event.notes && (
          <p className="break-words text-muted-foreground">{event.notes}</p>
        )}
        {price !== null && <p className="num font-medium">{formatPrice(price)}</p>}
      </div>
      {canEdit && (
        <div className="-mt-1.5 -mr-2 shrink-0">
          <RowActions
            noun="evento de llanta"
            plate={plate}
            date={event.date}
            onEdit={onEdit}
            remove={() => deleteTireEventAction(event.id)}
            onResult={onResult}
          />
        </div>
      )}
    </li>
  );
}

/**
 * The tires of a trailer: 3 axles x (left pair, right pair) = 12 fixed positions, each showing its
 * latest event. A position opens its history, newest first, and (for who can edit) lets you register,
 * edit and delete events. The identity is the position, never the physical tire.
 */
export function TrailerTiresPanel({
  plate,
  events,
  today,
  canEdit,
}: {
  plate: string;
  events: readonly TireEventRow[];
  today: IsoDate;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<TirePosition | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "history" });
  const [notice, notify] = useNotice();

  const providers = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) if ((e.type === "CHANGE" || e.type === "REPAIR") && e.provider) names.add(e.provider);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [events]);

  const close = () => {
    setSelected(null);
    setMode({ kind: "history" });
  };
  const onResult = (result: ActionResult) => {
    notify(result.ok ? { tone: "ok", text: result.message } : { tone: "error", text: result.error });
  };
  const done = (message: string) => {
    onResult({ ok: true, message });
    setMode({ kind: "history" });
  };

  const history = selected ? eventsOfPosition(events, selected) : [];
  const title =
    mode.kind === "create" ? "Registrar evento" : mode.kind === "edit" ? "Editar evento" : selected ? positionLabel(selected) : "";

  return (
    <div className="space-y-3 pt-3">
      <p className="text-sm text-muted-foreground">
        12 posiciones: toca una para ver su historial{canEdit ? " y registrar eventos" : ""}.
      </p>
      {AXLES.map((axle) => {
        const positions = positionsOfAxle(axle);
        return (
          <section key={axle} aria-label={`Eje ${axle}`} className="rounded-xl border p-3">
            <h3 className="micro-label mb-2">Eje {axle}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {([positions.slice(0, 2), positions.slice(2)] as const).map((pair) => (
                <div key={pair[0].side} className="min-w-0 space-y-1.5">
                  <p className="text-xs text-muted-foreground">{SIDE_TITLES[pair[0].side]}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {pair.map((info) => (
                      <PositionCell
                        key={info.code}
                        info={info}
                        events={events}
                        onSelect={() => {
                          setSelected(info.code);
                          setMode({ kind: "history" });
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <NoticeToast notice={notice} />

      <SlideOver
        open={selected !== null}
        onOpenChange={(open) => !open && close()}
        title={title}
        description={mode.kind === "history" ? plate : `${plate} · ${selected ? positionLabel(selected) : ""}`}
      >
        {selected && mode.kind === "history" && (
          <div className="space-y-3">
            {canEdit && (
              <Button type="button" className="h-11 w-full md:h-9 md:w-auto" onClick={() => setMode({ kind: "create" })}>
                <Plus aria-hidden />
                Registrar evento
              </Button>
            )}
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin registro en esta posición.</p>
            ) : (
              <ul className="border-t">
                {history.map((event) => (
                  <HistoryItem
                    key={event.id}
                    event={event}
                    position={selected}
                    plate={plate}
                    canEdit={canEdit}
                    onEdit={() => setMode({ kind: "edit", event })}
                    onResult={onResult}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
        {selected && mode.kind === "create" && (
          <TireEventForm
            plate={plate}
            position={selected}
            today={today}
            providers={providers}
            onDone={done}
            onCancel={() => setMode({ kind: "history" })}
          />
        )}
        {selected && mode.kind === "edit" && (
          <TireEventForm
            key={mode.event.id}
            plate={plate}
            position={selected}
            today={today}
            providers={providers}
            row={mode.event}
            onDone={done}
            onCancel={() => setMode({ kind: "history" })}
          />
        )}
      </SlideOver>
    </div>
  );
}
