"use client";

import { X } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { filterClients } from "@/modules/clients/domain/client-row";

export interface ClientOption {
  id: number;
  name: string;
  nit: string | null;
}

const MAX_OPTIONS = 8;

/**
 * Client search with suggestions: type part of a name or NIT and pick one. The chosen id travels in
 * a hidden `clientId` field, so the form posts it like any other control.
 */
export function ClientPicker({
  id,
  clients,
  defaultClientId,
  className,
}: {
  id: string;
  clients: readonly ClientOption[];
  defaultClientId?: number;
  className?: string;
}) {
  const listId = useId();
  const initial = clients.find((c) => c.id === defaultClientId) ?? null;
  const [selected, setSelected] = useState<ClientOption | null>(initial);
  const [query, setQuery] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(
    () => (selected || query.trim() === "" ? [] : filterClients(clients, query).slice(0, MAX_OPTIONS)),
    [clients, query, selected],
  );
  const expanded = open && !selected && query.trim() !== "";

  function choose(option: ClientOption) {
    setSelected(option);
    setQuery(option.name);
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setActive(0);
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
    <div
      className={cn("relative", className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <input type="hidden" name="clientId" value={selected?.id ?? ""} />
      <Input
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && options[active] ? `${listId}-${options[active].id}` : undefined}
        className="h-10 pr-9 md:h-9"
        value={query}
        placeholder="Buscar por nombre o NIT"
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {(selected || query) && (
        <button
          type="button"
          onClick={clear}
          aria-label="Quitar cliente"
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="Clientes"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-soft"
      >
        {options.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Ningún cliente coincide.</li>
        ) : (
          options.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${option.id}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: the input would lose focus and close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-2 text-sm",
                index === active && "bg-muted",
              )}
            >
              <span className="font-medium">{option.name}</span>
              {option.nit && <span className="num ml-2 text-xs text-muted-foreground">{formatNit(option.nit)}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
