"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Side sheet on base-ui Dialog: focus trap, Esc, backdrop click and scroll
 * lock for free. `right` is the work panel (bottom sheet on phones, 28rem
 * column from `md`); `left` is the navigation drawer. Children mount only
 * while the dialog is open, so forms always start fresh.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  bodyClassName = "px-5 py-5",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  side?: "right" | "left";
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/35 opacity-100 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          className={cn(
            "fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-soft outline-none transition-transform duration-200 ease-out motion-reduce:transition-none",
            side === "right"
              ? "inset-x-0 bottom-0 max-h-[92dvh] translate-y-0 rounded-t-2xl border-t data-ending-style:translate-y-full data-starting-style:translate-y-full md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:max-h-none md:w-[28rem] md:translate-x-0 md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l md:data-ending-style:translate-x-full md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-full md:data-starting-style:translate-y-0"
              : "inset-y-0 left-0 w-[17.5rem] max-w-[85vw] translate-x-0 border-r data-ending-style:-translate-x-full data-starting-style:-translate-x-full",
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base leading-snug font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="-mt-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", bodyClassName)}>{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
