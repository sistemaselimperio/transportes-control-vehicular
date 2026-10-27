"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/app/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteLogbookEntriesAction } from "../application/logbook-actions";
import { normalizePlateQuery, type LogbookTab } from "../domain/logbook";

/**
 * Confirmation to delete every record the list shows (one vehicle, one tab, one period). Typing the
 * plate arms the button; the server re-derives the scope from the same filters, never from ids.
 */
export function LogbookBulkDelete({
  tab,
  plate,
  from,
  to,
  count,
  scopeText,
  onDone,
  onCancel,
}: {
  tab: LogbookTab;
  plate: string;
  from: string;
  to: string;
  count: number;
  /** What is about to go, in words: "75 registros de Mantenimiento de WOM-158 · Todo el historial". */
  scopeText: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const armed = normalizePlateQuery(typed) === normalizePlateQuery(plate);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteLogbookEntriesAction(tab, plate, from, to);
      if (result.ok) onDone(result.message);
      else setError(result.error);
    });
  }

  return (
    <div data-slot="action-form" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Se eliminarán {scopeText}.</p>
            <p className="text-muted-foreground">Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <Field label={`Escribe la placa ${plate} para confirmar`} htmlFor="logbook-bulk-plate">
          <Input
            id="logbook-bulk-plate"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={pending}
            className="h-11 uppercase md:h-9"
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" className="h-11 px-4 md:h-9" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" className="h-11 px-4 md:h-9" disabled={!armed || pending} onClick={confirm}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {count === 1 ? "Eliminar 1 registro" : `Eliminar ${count} registros`}
        </Button>
      </div>
    </div>
  );
}
