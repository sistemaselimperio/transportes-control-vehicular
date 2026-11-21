"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatPesos } from "@/modules/vehicles/ui/vehicle-people-forms";

/** Peso amount with a "$" prefix and live thousands separators; the server action reads the digits. */
export function PesosInput({
  id,
  name,
  defaultValue,
  required,
  onValueChange,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
  required?: boolean;
  /** Called with the formatted text on every change, for forms that keep the value in their own state. */
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue == null ? "" : formatPesos(String(defaultValue)));
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        $
      </span>
      <Input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        className="num h-10 pl-7 md:h-9"
        value={value}
        required={required}
        onChange={(e) => {
          const next = formatPesos(e.target.value);
          setValue(next);
          onValueChange?.(next);
        }}
      />
    </div>
  );
}
