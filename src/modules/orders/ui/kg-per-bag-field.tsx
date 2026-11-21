"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDecimal } from "@/modules/shared/domain/decimal";
import { setKgPerBagAction } from "../application/order-actions";

/**
 * The global kilograms per bag. Everyone reads it; only whoever manages the orders gets the input.
 * Changing it recalculates every weight on the screen, since weights are never stored.
 */
export function KgPerBagField({
  kgPerBag,
  canEdit,
  onDone,
}: {
  kgPerBag: number;
  canEdit: boolean;
  onDone: (message: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return <p className="num text-sm text-muted-foreground">{formatDecimal(kgPerBag, 2)} kg por bulto</p>;
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await setKgPerBagAction(fd);
          if (result.ok) onDone(result.message);
          else setError(result.error);
        });
      }}
    >
      <div>
        <Label htmlFor="kg-per-bag" className="mb-1 block text-xs text-muted-foreground">
          Kg por bulto
        </Label>
        <Input
          id="kg-per-bag"
          name="kgPerBag"
          inputMode="decimal"
          className="num h-11 w-28 md:h-9"
          // A new value from the server remounts the field with it.
          key={kgPerBag}
          defaultValue={String(kgPerBag)}
          autoComplete="off"
          required
        />
      </div>
      <Button type="submit" variant="outline" className="h-11 px-4 md:h-9" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
