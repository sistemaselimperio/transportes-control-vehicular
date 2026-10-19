"use client";

import { TabBar } from "@/components/app/tab-bar";
import { FLEET_VIEWS, type FleetView } from "../domain/fleet-views";

/** View tabs of /flota with live counts (scrolling chips on phones). */
export function FleetViewTabs({
  active,
  counts,
  onSelect,
}: {
  active: FleetView;
  counts: Record<FleetView, number>;
  onSelect: (view: FleetView) => void;
}) {
  return (
    <TabBar
      label="Vistas de la flota"
      items={FLEET_VIEWS.map((v) => ({ key: v.key, label: v.label, count: counts[v.key] }))}
      active={active}
      onSelect={onSelect}
      idPrefix="fleet-tab"
      panelId="fleet-panel"
      chips
    />
  );
}
