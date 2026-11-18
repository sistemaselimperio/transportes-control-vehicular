"use client";

import { CircleAlert, CircleCheck, ClipboardCheck, Sun, type LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface FormStep<K extends string> {
  key: K;
  title: string;
  /** One plain line saying what the step asks for. */
  hint: string;
  icon: LucideIcon;
  /** Progress line, e.g. "12 de 40 puntos". */
  progress: string;
  complete: boolean;
  hasError: boolean;
}

/**
 * Big numbered step tabs for the public form, built for older drivers on a phone: large text,
 * a step number, an icon, a plain hint and a status line ("Completo" / "Falta llenar"), with the
 * active step filled so it can't be confused with the inactive one. Not the app's TabBar on purpose.
 * Arrow keys / Home / End move between steps. Pair each step with `role="tabpanel"` `${panelId}-${key}`.
 */
export function FormStepTabs<K extends string>({
  label,
  steps,
  active,
  onSelect,
  idPrefix,
  panelId,
}: {
  label: string;
  steps: ReadonlyArray<FormStep<K>>;
  active: K;
  onSelect: (key: K) => void;
  idPrefix: string;
  panelId: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const index = steps.findIndex((s) => s.key === active);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? steps.length - 1 : (index + step + steps.length) % steps.length;
    onSelect(steps[next].key);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="grid grid-cols-1 gap-3 sm:sticky sm:top-0 sm:z-20 sm:grid-cols-2 sm:bg-background/95 sm:py-2 sm:backdrop-blur"
    >
      {steps.map((s, i) => {
        const selected = s.key === active;
        const Icon = s.icon;
        const StatusIcon = s.hasError ? CircleAlert : CircleCheck;
        return (
          <button
            key={s.key}
            id={`${idPrefix}-${s.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${panelId}-${s.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(s.key)}
            className={cn(
              "flex min-h-20 w-full min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-2xl border-4 p-3 text-left outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-ring/70 active:scale-[0.98] motion-reduce:active:scale-100 sm:p-4",
              selected
                ? "border-foreground bg-primary text-primary-foreground shadow-soft"
                : "border-foreground/25 bg-card text-foreground hover:border-foreground/60",
              s.hasError && !selected && "border-destructive",
            )}
          >
            {/* Number + icon on one row, the title below it with the full card width. */}
            <span className="flex w-full min-w-0 flex-col items-start gap-1.5">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-lg font-bold",
                    selected ? "bg-foreground text-primary" : "bg-foreground/10 text-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <Icon aria-hidden className="size-7 shrink-0" />
              </span>
              <span className="sr-only">Paso {i + 1}:</span>
              <span className="w-full min-w-0 text-lg leading-tight font-bold break-words hyphens-auto sm:text-xl">
                {s.title}
              </span>
            </span>
            <span className={cn("text-sm leading-snug break-words sm:text-base", selected ? "text-foreground" : "text-muted-foreground")}>
              {s.hint}
            </span>
            <span
              className={cn(
                "mt-auto flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold whitespace-nowrap sm:text-base",
                s.hasError
                  ? "bg-destructive text-white"
                  : s.complete
                    ? "bg-ok text-ok-foreground"
                    : selected
                      ? "bg-foreground/10"
                      : "bg-muted",
              )}
            >
              {(s.hasError || s.complete) && <StatusIcon aria-hidden className="size-4 shrink-0" />}
              {s.hasError ? "Falta llenar" : s.complete ? "Completo" : s.progress}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const STEP_ICONS = { inspection: ClipboardCheck, daily: Sun } as const;
