"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { TabBar } from "@/components/app/tab-bar";
import { FILE_TABS, parseTabParam, type FileTab } from "../domain/file-tabs";

/**
 * Tabs of the vehicle file. Every panel is rendered by the server; switching
 * is instant and mirrored into `?tab=` so the link stays shareable. The header
 * and the tab bar stay pinned on desktop while the panel scrolls.
 */
export function VehicleFileTabs({
  header,
  panels,
}: {
  header: ReactNode;
  panels: Record<FileTab, ReactNode>;
}) {
  // The URL (`?tab=`) is the single source of truth for the active tab.
  const tab = parseTabParam(useSearchParams().get("tab") ?? undefined);

  function select(next: FileTab) {
    // history.replaceState feeds useSearchParams without re-running the server page.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    } catch {
      // The URL is a convenience; the tab still switches.
    }
  }

  return (
    <div className="space-y-5">
      <div className="z-20 -mx-4 space-y-3 bg-background px-4 pt-1 sm:-mx-6 sm:px-6 md:sticky md:top-0 md:-mx-8 md:px-8">
        {header}
        <TabBar
          label="Secciones del vehículo"
          items={FILE_TABS}
          active={tab}
          onSelect={select}
          idPrefix="file-tab"
          panelId="file-panel"
        />
      </div>

      {FILE_TABS.map(({ key }) => (
        <div
          key={key}
          id={key === tab ? "file-panel" : undefined}
          role="tabpanel"
          aria-labelledby={`file-tab-${key}`}
          hidden={key !== tab}
          className="space-y-5"
        >
          {panels[key]}
        </div>
      ))}
    </div>
  );
}
