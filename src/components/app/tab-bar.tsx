"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<K extends string> {
  key: K;
  label: string;
  /** Optional live count shown next to the label. */
  count?: number;
}

/**
 * Tabs with an olive underline on a neutral track. With `chips`, below `xl`
 * they become a grid of count-first tiles so every view stays in sight
 * (3 per row, 6 when the content column is wide enough).
 * Arrow keys / Home / End move between tabs.
 * Pair every tab with a `role="tabpanel"` whose id is `panelId`.
 */
export function TabBar<K extends string>({
  label,
  items,
  active,
  onSelect,
  idPrefix,
  panelId,
  chips = false,
}: {
  label: string;
  items: ReadonlyArray<TabItem<K>>;
  active: K;
  onSelect: (key: K) => void;
  idPrefix: string;
  panelId: string;
  chips?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const index = items.findIndex((v) => v.key === active);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (index + step + items.length) % items.length;
    onSelect(items[next].key);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "border-b-2 border-border",
        chips && "max-xl:grid max-xl:grid-cols-3 max-xl:gap-2 max-xl:overflow-visible max-xl:border-b-0 lg:max-xl:grid-cols-6",
      )}
    >
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            id={`${idPrefix}-${item.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(item.key)}
            className={cn(
              "-mb-0.5 flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-4 text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset active:scale-[0.98]",
              chips &&
                "relative overflow-hidden max-xl:mb-0 max-xl:h-auto max-xl:min-h-14 max-xl:min-w-0 max-xl:flex-col-reverse max-xl:items-start max-xl:justify-center max-xl:gap-1 max-xl:rounded-xl max-xl:border max-xl:border-border max-xl:bg-card max-xl:px-3 max-xl:py-2 max-xl:text-left max-xl:text-xs max-xl:whitespace-normal",
              selected &&
                (chips
                  ? "border-brand bg-secondary/70 font-semibold text-foreground max-xl:bg-secondary"
                  : "border-brand font-semibold text-foreground"),
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "num min-w-6 rounded-[5px] px-1.5 py-1 text-center text-xs leading-none",
                  selected ? "bg-primary text-primary-foreground ring-1 ring-foreground/20" : "bg-muted",
                  // Tiles: the count is the headline number, not a badge.
                  chips &&
                    "max-xl:min-w-0 max-xl:bg-transparent max-xl:p-0 max-xl:text-left max-xl:text-lg max-xl:font-semibold max-xl:ring-0",
                )}
              >
                {item.count}
              </span>
            )}
            {/* Active bar as its own element, so no border or shadow rule can hide it. */}
            {chips && selected && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1 bg-brand animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
