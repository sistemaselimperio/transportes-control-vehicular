"use client";

import { useState } from "react";
import { TabBar } from "@/components/app/tab-bar";
import { LOGBOOK_TABS, type LogbookTab, type VehicleLogbook } from "../domain/logbook";
import { CompactFuel, CompactOilChanges, CompactServices, CompactTires } from "./logbook-lists";

/**
 * The vehicle's logbook inside its file's Historial: the same four records as the Bitácora page,
 * filtered to this vehicle and limited to the latest few of each kind (the query does the limit).
 * One tab per kind shows its read-only list; the link to the Bitácora page sits next to the
 * Historial tabs. The tab labels carry no counts: the lists are truncated, so a count would mislead.
 */
export function VehicleLogbookPanel({
  logbook,
  tabs = LOGBOOK_TABS,
}: {
  logbook: VehicleLogbook;
  /** Tabs to offer (see `logbookTabsFor`); the first one opens. */
  tabs?: ReadonlyArray<{ key: LogbookTab; label: string }>;
}) {
  const [tab, setTab] = useState<LogbookTab>(tabs[0]?.key ?? "servicios");

  return (
    <div className="pt-3">
      <TabBar
        label="Registros de la bitácora"
        items={tabs}
        active={tab}
        onSelect={setTab}
        idPrefix="vehicle-logbook-tab"
        panelId="vehicle-logbook-panel"
      />
      <div id="vehicle-logbook-panel" role="tabpanel" aria-labelledby={`vehicle-logbook-tab-${tab}`} className="pt-2">
        {tab === "servicios" && <CompactServices rows={logbook.services} />}
        {tab === "aceite" && <CompactOilChanges rows={logbook.oilChanges} />}
        {tab === "llantas" && <CompactTires rows={logbook.tires} />}
        {tab === "combustible" && <CompactFuel rows={logbook.fuel} />}
      </div>
    </div>
  );
}
