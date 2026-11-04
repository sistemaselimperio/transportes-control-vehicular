"use client";

import { ArrowUpRight, BookOpen, ClipboardCheck, Route } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/app/tab-bar";
import { HISTORY_TABS, type HistoryTab } from "../domain/history-tab";
import { Section } from "./file-section";

const ICONS = { preoperacionales: ClipboardCheck, viajes: Route, bitacora: BookOpen } as const;
const TABS = HISTORY_TABS.map((t) => ({ ...t, icon: ICONS[t.key] }));

export interface HistoryLink {
  href: string;
  label: string;
}

/**
 * "Historial" of the vehicle file: Preoperacionales, Viajes and Bitácora as read-only lists of the
 * latest records. The tab lives in the `historial` search param so a link opens on it; switching
 * rewrites the URL with `history.replaceState` (no server round trip, as in the fleet tabs).
 * Each panel is rendered by the server and passed in; only the active one is mounted. Beside the
 * tabs, a link opens the active tab's full page on this vehicle (`null` hides it for that tab).
 */
export function VehicleHistorySection({
  initialTab,
  panels,
  links,
}: {
  initialTab: HistoryTab;
  panels: Record<HistoryTab, ReactNode>;
  links: Record<HistoryTab, HistoryLink | null>;
}) {
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const link = links[tab];

  function select(next: HistoryTab) {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("historial", next);
      window.history.replaceState(null, "", url);
    } catch {
      // The URL is a convenience; the tab still switches.
    }
  }

  return (
    <Section id="historial" title="Historial">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <TabBar
          label="Historial del vehículo"
          items={TABS}
          active={tab}
          onSelect={select}
          idPrefix="vehicle-history-tab"
          panelId="vehicle-history-panel"
          variant="segmented"
        />
        {link && (
          <Link
            key={tab}
            href={link.href}
            className="group inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.98] animate-in fade-in-0 duration-200 motion-reduce:animate-none max-sm:w-full max-sm:justify-center max-sm:bg-muted"
          >
            {link.label}
            <ArrowUpRight
              aria-hidden
              className="size-4 text-brand transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
            />
          </Link>
        )}
      </div>
      <div id="vehicle-history-panel" role="tabpanel" aria-labelledby={`vehicle-history-tab-${tab}`} className="pt-2">
        {panels[tab]}
      </div>
    </Section>
  );
}
