"use client";

import { CheckCircle2, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import type { DriverRow } from "../domain/driver-row";
import { DriverForm } from "./driver-form";
import { DriverList } from "./driver-list";

/** Drivers page: the list plus the create / edit side sheet. */
export function DriversView({ rows }: { rows: readonly DriverRow[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRow | undefined>();
  const [message, setMessage] = useState<string | null>(null);

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
      <DriverList rows={rows} onEdit={openForm} />

      {message && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-4 py-3 text-sm text-ok-foreground shadow-soft"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}

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
