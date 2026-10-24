"use client";

import { useEffect } from "react";

const SECTION_BY_TAB: Record<string, string> = {
  documentos: "documentos",
  mantenimiento: "mantenimiento",
  bitacora: "bitacora",
  personas: "personas",
};

/**
 * Old links used `?tab=<name>` when the vehicle file had tabs. The file is one page now,
 * so the param just scrolls to the matching section; anything else is ignored.
 */
export function TabParamScroll() {
  useEffect(() => {
    try {
      const id = SECTION_BY_TAB[new URLSearchParams(window.location.search).get("tab") ?? ""];
      document.getElementById(id ?? "")?.scrollIntoView({ block: "start" });
    } catch {
      // Scrolling is a convenience only.
    }
  }, []);
  return null;
}
