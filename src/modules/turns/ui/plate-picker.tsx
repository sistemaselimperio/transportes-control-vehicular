"use client";

import { Truck } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FIELD = "h-10 md:h-9";
const MAX_OPTIONS = 8;

export type Vehicle = { id: number; plate: string };

/** Plates compare without spaces, dashes or case: "abc-123" finds "ABC123". */
function normalize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Plates that start with what was typed come first, then the ones that merely contain it. */
function filterPlates(query: string, vehicles: ReadonlyArray<Vehicle>): Vehicle[] {
  const q = normalize(query);
  if (!q) return vehicles.slice(0, MAX_OPTIONS);
  const starts: Vehicle[] = [];
  const contains: Vehicle[] = [];
  for (const v of vehicles) {
    const plate = normalize(v.plate);
    if (plate.startsWith(q)) starts.push(v);
    else if (plate.includes(q)) contains.push(v);
  }
  return [...starts, ...contains].slice(0, MAX_OPTIONS);
}

/** A plate search box: typing filters the active vehicles, and picking one reports it. */
export function PlatePicker({
  id = "turn-vehicle",
  vehicles,
  selected,
  onSelect,
  invalid,
}: {
  id?: string;
  vehicles: ReadonlyArray<Vehicle>;
  selected: Vehicle | null;
  onSelect: (vehicle: Vehicle | null) => void;
  invalid: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => filterPlates(query, vehicles), [query, vehicles]);
  const expanded = open && options.length > 0;
  const text = selected && !open ? selected.plate : query;

  function choose(vehicle: Vehicle) {
    onSelect(vehicle);
    setQuery(vehicle.plate);
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
    <div
      className="relative"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setOpen(false);
        // Leaving the box with an exact plate typed picks it, so nobody has to click the only match.
        const exact = vehicles.find((v) => normalize(v.plate) === normalize(query));
        if (exact) choose(exact);
      }}
    >
      <Truck
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && options[active] ? `${listId}-${options[active].id}` : undefined}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        placeholder="Busca la placa"
        className={cn(FIELD, "pl-8 font-medium uppercase placeholder:normal-case placeholder:font-normal")}
        value={text}
        onChange={(e) => {
          setQuery(e.target.value);
          onSelect(null);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Vehículos disponibles"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-soft"
      >
        {options.map((vehicle, index) => (
          <li
            key={vehicle.id}
            id={`${listId}-${vehicle.id}`}
            role="option"
            aria-selected={index === active}
            // mousedown, not click: the input would lose focus and close the list first.
            onMouseDown={(e) => {
              e.preventDefault();
              choose(vehicle);
            }}
            onMouseEnter={() => setActive(index)}
            className={cn("num cursor-pointer rounded-md px-3 py-2 text-sm font-medium", index === active && "bg-muted")}
          >
            {vehicle.plate}
          </li>
        ))}
      </ul>
    </div>
  );
}

