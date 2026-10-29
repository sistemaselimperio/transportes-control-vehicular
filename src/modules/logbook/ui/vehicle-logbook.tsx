"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TabBar } from "@/components/app/tab-bar";
import { Section } from "@/modules/vehicles/ui/file-section";
import { LOGBOOK_TABS, logbookHref, type LogbookTab, type VehicleLogbook } from "../domain/logbook";
import { CompactFuel, CompactOilChanges, CompactServices, CompactTires } from "./logbook-lists";

/**
 * The vehicle's logbook inside its file: the same four records as the Bitácora page, filtered to
 * this vehicle. One tab per kind shows its read-only list below; the heading links to the
 * Bitácora on this vehicle and tab, where records are created, edited and deleted (only for
 * users who can manage it).
 */
export function VehicleLogbookSection({
  plate,
  logbook,
  canManage = true,
}: {
  plate: string;
  logbook: VehicleLogbook;
  canManage?: boolean;
}) {
  const [tab, setTab] = useState<LogbookTab>("servicios");
  const counts: Record<LogbookTab, number> = {
    servicios: logbook.services.length,
    aceite: logbook.oilChanges.length,
    llantas: logbook.tires.length,
    combustible: logbook.fuel.length,
  };

  return (
    <Section
      id="bitacora"
      title="Bitácora"
      actions={
        canManage && (
          <Link
            href={logbookHref(plate, tab)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm text-muted-foreground underline decoration-muted-foreground/60 decoration-1 underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 md:min-h-8"
          >
            Gestionar en Bitácora
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )
      }
    >
      <TabBar
        label="Registros de la bitácora"
        items={LOGBOOK_TABS.map((t) => ({ ...t, count: counts[t.key] }))}
        active={tab}
        onSelect={setTab}
        idPrefix="vehicle-logbook-tab"
        panelId="vehicle-logbook-panel"
      />
      <div id="vehicle-logbook-panel" role="tabpanel" aria-labelledby={`vehicle-logbook-tab-${tab}`}>
        {tab === "servicios" && <CompactServices rows={logbook.services} />}
        {tab === "aceite" && <CompactOilChanges rows={logbook.oilChanges} />}
        {tab === "llantas" && <CompactTires rows={logbook.tires} />}
        {tab === "combustible" && <CompactFuel rows={logbook.fuel} />}
      </div>
    </Section>
  );
}
