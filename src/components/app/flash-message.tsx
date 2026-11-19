"use client";

import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/** A success message that clears itself after a few seconds. */
export function useFlashMessage(durationMs = 6000) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(
    (next: string) => {
      clearTimeout(timer.current);
      setMessage(next);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  return { message, flash };
}

/** The toast shown at the foot of the screen while a flash message is set. */
export function FlashMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground shadow-soft"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
