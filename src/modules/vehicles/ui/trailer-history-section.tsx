"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { TabBar, type TabItem } from "@/components/app/tab-bar";
import { Section } from "./file-section";

type TrailerTab = "llantas" | "bitacora";

const TABS: ReadonlyArray<TabItem<TrailerTab>> = [
  { key: "llantas", label: "Llantas" },
  { key: "bitacora", label: "Bitácora" },
];

/**
 * What a trailer's file keeps: its tires by position (Llantas) and its maintenance (Bitácora).
 * Each panel is rendered by the server; only the active one is mounted. `bitacoraHref` is the
 * link to the full Bitácora page, shown only on that tab (null for who cannot open it).
 */
export function TrailerHistorySection({
  llantas,
  bitacora,
  bitacoraHref,
}: {
  llantas: ReactNode;
  bitacora: ReactNode;
  bitacoraHref: string | null;
}) {
  const [tab, setTab] = useState<TrailerTab>("llantas");
  return (
    <Section
      id="bitacora"
      title="Historial"
      actions={
        tab === "bitacora" &&
        bitacoraHref && (
          <Link
            href={bitacoraHref}
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-4 transition-colors duration-150 hover:text-foreground md:min-h-7"
          >
            Ver bitácora
          </Link>
        )
      }
    >
      <div className="pt-3">
        <TabBar
          label="Historial del remolque"
          items={TABS}
          active={tab}
          onSelect={setTab}
          idPrefix="trailer-history-tab"
          panelId="trailer-history-panel"
          variant="segmented"
        />
      </div>
      <div id="trailer-history-panel" role="tabpanel" aria-labelledby={`trailer-history-tab-${tab}`}>
        {tab === "llantas" ? llantas : bitacora}
      </div>
    </Section>
  );
}
