"use client";

import { cn } from "@/lib/utils";
import { KIND_LABELS, pillText } from "@/modules/alerts/ui/attention-actions";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import type { ItemKind } from "@/modules/dashboard/domain/dashboard-metrics";
import type { Urgency } from "../domain/urgency";
import type { QueueVehicle, VehicleGroup } from "../domain/vehicle-queue";

const BLOCKS: Record<Urgency, { id: string; title: string; range: string; tone?: "danger" }> = {
  overdue: { id: "vencido", title: "Vencido", range: "ya pasó la fecha", tone: "danger" },
  week: { id: "esta-semana", title: "Esta semana", range: "hoy a 7 días" },
  month: { id: "proximos-30", title: "Próximos 30 días", range: "8 a 30 días" },
};

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset";

function VehicleRow({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: QueueVehicle;
  selected: boolean;
  onSelect: (plate: string, kind: ItemKind | null) => void;
}) {
  return (
    <li
      data-active={selected ? "true" : undefined}
      className="flex flex-col gap-x-4 gap-y-1 px-5 py-2 transition-colors duration-150 hover:bg-muted data-[active=true]:bg-secondary md:flex-row md:items-center"
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        aria-label={`Ver pendientes de ${vehicle.plate}`}
        onClick={() => onSelect(vehicle.plate, null)}
        className={cn(
          "flex min-h-11 flex-none items-center self-start rounded-md transition-transform duration-150 active:scale-[0.97] md:w-28",
          focus,
        )}
      >
        <span className="plate">{vehicle.plate}</span>
      </button>
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 md:gap-y-1" aria-label={`Pendientes de ${vehicle.plate}`}>
        {vehicle.items.map((item) => (
          <li key={item.kind} className="flex-none">
            <button
              type="button"
              onClick={() => onSelect(vehicle.plate, item.kind)}
              className={cn("flex min-h-11 items-center rounded-md transition-transform duration-150 active:scale-[0.97] md:min-h-9", focus)}
            >
              <StatusPill status={item.status} className="flex-none whitespace-nowrap">
                {KIND_LABELS[item.kind]} · {pillText(item)}
              </StatusPill>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Urgency groups of vehicles (already filtered, empty ones omitted); picking a row or chip selects it. */
export function TodayTimeline({
  groups,
  selectedPlate,
  onSelect,
}: {
  groups: VehicleGroup[];
  selectedPlate: string | null;
  onSelect: (plate: string, kind: ItemKind | null) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map(({ urgency, vehicles }) => {
        const block = BLOCKS[urgency];
        return (
          <section key={urgency} id={block.id} aria-labelledby={`${block.id}-title`} className="panel scroll-mt-20">
            <div className="plate-head px-5" data-tone={block.tone}>
              <h2 id={`${block.id}-title`} className="micro-label text-foreground">
                {block.title}
              </h2>
              <span className="micro-label">{block.range}</span>
              <span className="num ml-auto text-sm font-semibold">{vehicles.length}</span>
            </div>
            <ul className="divide-y">
              {vehicles.map((v) => (
                <VehicleRow key={v.plate} vehicle={v} selected={v.plate === selectedPlate} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
