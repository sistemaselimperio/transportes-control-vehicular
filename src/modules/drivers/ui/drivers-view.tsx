"use client";

import { CheckCircle2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchDrivers, type DriverRow } from "../domain/driver-row";
import { DeleteDriverDialog } from "./delete-driver-dialog";
import { DriverForm } from "./driver-form";
import { DriverList } from "./driver-list";

/** Drivers page: a search box, the list, and the create / edit side sheet and the delete confirmation. */
export function DriversView({ rows }: { rows: readonly DriverRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRow | undefined>();
  const [deleting, setDeleting] = useState<DriverRow | undefined>();
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
          <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
            <Plus aria-hidden />
            Nuevo conductor
          </Button>
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
        <DriverList rows={shown} onEdit={openForm} onDelete={setDeleting} />
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

      <DeleteDriverDialog
        driver={deleting}
        onClose={() => setDeleting(undefined)}
        onDone={(msg) => {
          setMessage(msg);
          setTimeout(() => setMessage(null), 6000);
        }}
      />

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
    </section>
  );
}
