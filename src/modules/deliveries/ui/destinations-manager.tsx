"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/modules/vehicles/application/vehicle-actions";
import {
  createDestinationAction,
  deleteDestinationAction,
  renameDestinationAction,
} from "../application/delivery-actions";
import type { DestinationRow } from "../application/delivery-queries";

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** One destination: shown, renamed in place, or confirmed for deletion. */
function DestinationItem({ row, onDone }: { row: DestinationRow; onDone: (message: string) => void }) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMode("view");
        onDone(result.message);
      } else {
        setError(result.error);
      }
    });
  }

  if (mode === "rename") {
    return (
      <li className="space-y-1.5 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => renameDestinationAction(row.id, fd));
          }}
        >
          <Label htmlFor={`destination-${row.id}`} className="sr-only">
            Nombre del destino
          </Label>
          <Input id={`destination-${row.id}`} name="name" defaultValue={row.name} className="h-10 md:h-9" autoComplete="off" required />
          <Button type="submit" size="icon" className="size-10 md:size-9" aria-label="Guardar nombre" disabled={pending}>
            <Check aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 md:size-9"
            aria-label="Cancelar"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMode("view");
            }}
          >
            <X aria-hidden />
          </Button>
        </form>
        <ErrorLine message={error} />
      </li>
    );
  }

  if (mode === "delete") {
    return (
      <li className="space-y-1.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            ¿Eliminar <span className="font-medium">{row.name}</span>?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              className="h-10 px-3 md:h-9"
              disabled={pending}
              onClick={() => run(() => deleteDestinationAction(row.id))}
            >
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 px-3 md:h-9"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMode("view");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
        <ErrorLine message={error} />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <p className="min-w-0 truncate text-sm">
        <span className="font-medium">{row.name}</span>
        <span className="num ml-2 text-xs text-muted-foreground">
          {row.deliveryCount} {row.deliveryCount === 1 ? "entrega" : "entregas"}
        </span>
      </p>
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 md:size-9"
          aria-label={`Renombrar ${row.name}`}
          title="Renombrar"
          onClick={() => setMode("rename")}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-destructive md:size-9"
          aria-label={`Eliminar ${row.name}`}
          title="Eliminar"
          onClick={() => setMode("delete")}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}

/** The editable destination list: add, rename and delete (a destination in use cannot be deleted). */
export function DestinationsManager({
  destinations,
  onDone,
}: {
  destinations: readonly DestinationRow[];
  onDone: (message: string) => void;
}) {
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        key={formKey}
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await createDestinationAction(fd);
            if (result.ok) {
              setFormKey((k) => k + 1);
              onDone(result.message);
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <Label htmlFor="destination-new" className="text-sm">
          Nuevo destino
        </Label>
        <div className="flex gap-2">
          <Input id="destination-new" name="name" className="h-10 md:h-9" autoComplete="off" required />
          <Button type="submit" className="h-10 px-3 md:h-9" disabled={pending}>
            <Plus aria-hidden />
            Agregar
          </Button>
        </div>
        <ErrorLine message={error} />
      </form>

      <ul className="divide-y border-y">
        {destinations.map((d) => (
          <DestinationItem key={d.id} row={d} onDone={onDone} />
        ))}
      </ul>
      {destinations.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay destinos.</p>}
    </div>
  );
}
