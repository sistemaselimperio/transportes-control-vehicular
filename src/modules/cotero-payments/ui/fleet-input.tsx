"use client";

import { Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  matchDriver,
  matchPlate,
  suggestDrivers,
  suggestPlates,
  tractorsOf,
  trailersOf,
  type FleetCandidates,
} from "../domain/fleet-matching";
import { formatVehiclePlate, normalizeVehiclePlate } from "../domain/plates";
import type { DraftIssue } from "../domain/receipt-rules";
import { CorrectedBadge } from "./badges";
import type { FleetControl } from "./use-fleet";

export type FleetInputKind = "vehicle" | "trailer" | "driver";

interface Option {
  key: number;
  label: string;
}

const MAX_OPTIONS = 8;
const DRIVERS_PATH = "/conductores";

/** What the fleet says about the text: how it matched, the list to pick from while typing, and the closest names. */
function analyse(kind: FleetInputKind, value: string, fleet: FleetCandidates) {
  if (kind === "driver") {
    const match = matchDriver(value, fleet.drivers);
    return {
      status: match.status,
      options: suggestDrivers(value, fleet.drivers, MAX_OPTIONS).map((d): Option => ({ key: d.id, label: d.name })),
      closest: match.status === "unmatched" ? match.suggestions.map((d): Option => ({ key: d.id, label: d.name })) : [],
    };
  }
  const candidates = kind === "vehicle" ? tractorsOf(fleet) : trailersOf(fleet);
  const match = matchPlate(value, candidates);
  return {
    status: match.status,
    options: suggestPlates(value, candidates, MAX_OPTIONS).map((v): Option => ({ key: v.id, label: v.plate })),
    closest: match.status === "unmatched" ? match.suggestions.map((v): Option => ({ key: v.id, label: v.plate })) : [],
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access (insecure context or denied): the plate is on screen to be copied by hand.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copiada" : "Copiar placa"}
    </button>
  );
}

/**
 * A plate or driver field tied to the fleet: while typing it lists the closest active entries; once left, a
 * value that is not in the fleet says so with what to do (suggestions, register it, ask the admin). A value
 * the AI read a little differently shows the "Corregido" badge with what was read.
 */
export function FleetInput({
  id,
  name,
  label,
  kind,
  value,
  onChange,
  fleet,
  required,
  issue,
  corrected,
  className,
}: {
  id: string;
  name: string;
  label: string;
  kind: FleetInputKind;
  value: string;
  onChange: (value: string) => void;
  fleet: FleetControl;
  required?: boolean;
  issue?: DraftIssue;
  /** The text the AI read, when this value is the fleet's correction of it. */
  corrected?: string;
  className?: string;
}) {
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const { status, options, closest } = useMemo(() => analyse(kind, value, fleet.fleet), [kind, value, fleet.fleet]);
  const expanded = open && options.length > 0;
  const unknown = status === "unmatched" && !focused;
  const plate = kind === "driver" ? "" : formatVehiclePlate(normalizeVehiclePlate(value));
  const invalid = unknown || issue?.kind === "missing";

  function choose(option: Option) {
    onChange(option.label);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter" && expanded && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && expanded) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className={className}>
      <Field label={label} htmlFor={id} required={required} hint={issue?.kind === "missing" ? "Falta este dato." : undefined}>
        <div
          className="relative"
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setFocused(false);
            setOpen(false);
          }}
        >
          <Input
            id={id}
            name={name}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && options[active] ? `${listId}-${options[active].key}` : undefined}
            aria-invalid={invalid ? true : undefined}
            autoComplete="off"
            className="h-10 md:h-9"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            hidden={!expanded}
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-soft"
          >
            {options.map((option, index) => (
              <li
                key={option.key}
                id={`${listId}-${option.key}`}
                role="option"
                aria-selected={index === active}
                // mousedown, not click: the input would lose focus and close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn("cursor-pointer rounded-md px-3 py-2 text-sm", index === active && "bg-muted")}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>

        {corrected !== undefined && status === "exact" && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <CorrectedBadge />
            Se leyó «{corrected}»
          </p>
        )}

        {unknown && (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive-soft p-2 text-xs text-destructive">
            {kind === "driver" ? (
              <p>
                <strong className="font-semibold">{value.trim()}</strong> no está en los conductores.
              </p>
            ) : (
              <p>
                <strong className="num font-semibold">{plate}</strong> no está en flota. Pídele al admin que lo registre.
              </p>
            )}
            {closest.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span>¿Quisiste decir?</span>
                {closest.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => choose(option)}
                    className="h-8 rounded-md border bg-background px-2 text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {kind === "driver" ? (
                <a
                  href={DRIVERS_PATH}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Ir a conductores
                </a>
              ) : (
                <CopyButton text={plate} />
              )}
              <button
                type="button"
                onClick={() => void fleet.refresh()}
                disabled={fleet.refreshing}
                className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-60"
              >
                {fleet.refreshing ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden />
                )}
                Actualizar sugerencias
              </button>
            </div>
          </div>
        )}
      </Field>
    </div>
  );
}
