"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreVertical } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onSelect: () => void;
  destructive?: boolean;
}

/** Kebab menu for the secondary actions of a card or screen (base-ui Menu: focus, arrows and Esc built in). */
export function ActionMenu({ label, items, className }: { label: string; items: readonly ActionMenuItem[]; className?: string }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground md:size-9",
          className,
        )}
      >
        <MoreVertical className="size-5 md:size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-[70] print:hidden">
          <Menu.Popup className="min-w-48 origin-(--transform-origin) rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            {items.map((item) => (
              <Menu.Item
                key={item.label}
                onClick={item.onSelect}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm font-medium outline-none select-none data-highlighted:bg-muted md:min-h-9",
                  item.destructive && "text-destructive data-highlighted:bg-destructive/10",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
