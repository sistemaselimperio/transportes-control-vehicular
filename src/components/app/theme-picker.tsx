"use client";

import { useSyncExternalStore } from "react";
import { THEME_OPTIONS, applyTheme, parseTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** <html data-theme> is the single source of truth; re-render whenever it changes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readTheme = (): Theme => parseTheme(document.documentElement.dataset.theme);
// The server does not know the browser's choice: nothing is marked until hydration.
const readServerTheme = (): Theme | null => null;

/** Color swatches for this browser's theme; the choice is stored locally, never on the server. */
export function ThemePicker() {
  const current = useSyncExternalStore(subscribe, readTheme, readServerTheme);

  return (
    <div role="group" aria-label="Color del sistema" className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Color</span>
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => applyTheme(option.value)}
          aria-pressed={current === option.value}
          aria-label={option.label}
          title={option.label}
          style={{ backgroundColor: option.swatch }}
          className={cn(
            "size-6 cursor-pointer rounded-full border border-foreground/25 transition-shadow duration-150 motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
            current === option.value && "ring-2 ring-foreground ring-offset-2 ring-offset-muted",
          )}
        />
      ))}
    </div>
  );
}
