"use client";

import { CheckCircle2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DeleteAllButton } from "@/components/app/delete-all-button";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAllDriversAction } from "../application/driver-actions";
import { searchDrivers, type DriverRow } from "../domain/driver-row";
import { DriverForm } from "./driver-form";
import { DriverList } from "./driver-list";

/** Drivers page: a search box, the list, and the create / edit side sheet (hidden when `readOnly`). */
export function DriversView({ rows, readOnly = false }: { rows: readonly DriverRow[]; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRow | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => searchDrivers(rows, query), [rows, query]);

  const openForm = (driver?: DriverRow) => {
    setMessage(null);
    setEditing(driver);
    setOpen(true);
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Conductores"
        description="Datos de cada conductor y los vehículos que maneja."
        actions={
          !readOnly && (
            <>
              <DeleteAllButton count={rows.length} title="Eliminar todos los conductores" action={deleteAllDriversAction}>
                <p className="font-medium">Se eliminarán TODOS los conductores, no solo los que ves en pantalla.</p>
                <p className="text-muted-foreground">
                  Se quitan también sus asignaciones a vehículos. Los vehículos no se eliminan.
                </p>
              </DeleteAllButton>
              <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
                <Plus aria-hidden />
                Nuevo conductor
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative min-w-0 flex-1 md:max-w-md md:flex-none md:basis-96">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="driver-search" className="sr-only">
            Buscar conductor por nombre, cédula, celular o placa
          </Label>
          <Input
            id="driver-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, cédula, celular o placa"
            className="h-11 pl-9 md:h-9"
            autoComplete="off"
          />
        </div>
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {shown.length} de {rows.length} conductores
        </p>
      </div>
      {query.trim() && shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún conductor coincide con «{query.trim()}».</p>
      ) : (
        <DriverList rows={shown} onEdit={readOnly ? undefined : openForm} />
      )}

      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground shadow-soft"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

      {!readOnly && (
        <SlideOver
          open={open}
          onOpenChange={setOpen}
          title={editing ? "Editar conductor" : "Nuevo conductor"}
          description={editing?.name}
        >
          <DriverForm
            driver={editing}
            onCancel={() => setOpen(false)}
            onDone={(msg) => {
              setMessage(msg);
              setTimeout(() => setMessage(null), 6000);
              setOpen(false);
            }}
          />
        </SlideOver>
      )}
    </section>
  );
}
