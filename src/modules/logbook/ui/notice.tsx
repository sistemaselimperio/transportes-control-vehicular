"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Notice = { tone: "ok" | "error"; text: string };

/** One toast at a time, gone after six seconds. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const notify = useCallback((next: Notice | null) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(next);
    if (next) timer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  return [notice, notify] as const;
}

export function NoticeToast({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        "fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-soft",
        notice.tone === "error"
          ? "border-destructive/20 bg-popover text-destructive"
          : "border-ok-foreground/20 bg-ok text-ok-foreground",
      )}
    >
      {notice.tone === "error" ? (
        <AlertCircle className="size-4 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      )}
      {notice.text}
    </p>
  );
}
