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
 * Tabs with an amber underline on a neutral track (md+), or scrolling chips
 * on phones when `chips` is set. Arrow keys / Home / End move between tabs.
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
        chips && "max-md:-mx-4 max-md:gap-2 max-md:border-b-0 max-md:px-4 max-md:pb-1 sm:max-md:-mx-6 sm:max-md:px-6",
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
              chips && "max-md:mb-0 max-md:rounded-full max-md:border max-md:bg-card",
              selected &&
                (chips
                  ? "border-primary font-medium text-foreground max-md:bg-muted"
                  : "border-primary font-medium text-foreground"),
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "num min-w-6 rounded-[5px] px-1.5 py-1 text-center text-xs leading-none",
                  selected ? "bg-primary/25 text-foreground" : "bg-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
