"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Modal built on the native <dialog>: focus trap, Esc and backdrop for free.
 * Bottom sheet on phones, centered card from `sm` up. Children mount only
 * while open so forms always start fresh.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="mt-auto mb-0 w-full max-w-none rounded-t-xl border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-xl"
    >
      {open && (
        <div className="max-h-[90dvh] overflow-y-auto p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mt-1 -mr-1 size-10"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X aria-hidden />
            </Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
