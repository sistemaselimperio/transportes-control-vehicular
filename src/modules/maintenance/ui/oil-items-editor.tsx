"use client";

import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OilItem } from "../domain/oil-items";

interface Row {
  key: number;
  quantity: string;
  detail: string;
}

const toRow = (item: OilItem, key: number): Row => ({
  key,
  quantity: String(item.quantity).replace(".", ","),
  detail: item.detail,
});

/**
 * List of supplies of an oil change ("48" + "CUARTOS DELO 15W40"). The rows travel in one hidden
 * `items` field as JSON, which `oilItemsField` parses on the server.
 */
export function OilItemsEditor({ initial, prefilled = false }: { initial: readonly OilItem[]; prefilled?: boolean }) {
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));

  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Insumos (opcional)</legend>
      {prefilled && rows.length > 0 && (
        <p className="text-xs text-muted-foreground">Copiados del cambio anterior; ajústalos si algo cambió.</p>
      )}
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(rows.map(({ quantity, detail }) => ({ quantity, detail })))}
      />
      {rows.map((row, i) => (
        <div key={row.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2">
          <Input
            aria-label={`Cantidad del insumo ${i + 1}`}
            inputMode="decimal"
            autoComplete="off"
            className="num h-10 md:h-9"
            value={row.quantity}
            placeholder="Cant."
            onChange={(e) => update(row.key, { quantity: e.target.value })}
          />
          <Input
            aria-label={`Descripción del insumo ${i + 1}`}
            autoComplete="off"
            className="h-10 md:h-9"
            value={row.detail}
            placeholder="Cuartos DELO 15W40"
            onChange={(e) => update(row.key, { detail: e.target.value })}
          />
          <button
            type="button"
            aria-label={`Quitar insumo ${i + 1}`}
            title="Quitar"
            onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/70 md:size-9"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-11 bg-transparent px-3 md:h-9"
        onClick={() => setRows((list) => [...list, { key: nextKey.current++, quantity: "", detail: "" }])}
      >
        <Plus aria-hidden />
        Agregar insumo
      </Button>
    </fieldset>
  );
}
