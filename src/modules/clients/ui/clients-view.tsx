"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { deleteClientAction } from "../application/client-actions";
import { filterClients, type ClientRow } from "../domain/client-row";
import { ClientDetail } from "./client-detail";
import { ClientForm } from "./client-form";
import { ClientList } from "./client-list";

/** Clients page: search, the list, the detail / create / edit side sheets and the delete confirmation. */
export function ClientsView({ rows, canManage }: { rows: readonly ClientRow[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | undefined>();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | undefined>();
  const { message, flash } = useFlashMessage();

  const shown = useMemo(() => filterClients(rows, query), [rows, query]);
  // Read the detail from the fresh rows, so an edit shows right away.
  const detail = detailId === null ? undefined : rows.find((r) => r.id === detailId);

  const openForm = (client?: ClientRow) => {
    setEditing(client);
    setFormOpen(true);
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Clientes del área comercial, con su dirección y link de ubicación."
        actions={
          canManage && (
            <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
              <Plus aria-hidden />
              Nuevo cliente
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-0 flex-1 md:max-w-md md:flex-none md:basis-96">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="client-search" className="sr-only">
            Buscar cliente por nombre o NIT
          </Label>
          <Input
            id="client-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre o NIT"
            className="h-11 pl-9 md:h-9"
            autoComplete="off"
          />
        </div>
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {shown.length} de {rows.length} clientes
        </p>
      </div>

      <ClientList
        rows={shown}
        canManage={canManage}
        onOpen={(row) => setDetailId(row.id)}
        onEdit={openForm}
        onDelete={setDeleting}
      />

      <FlashMessage message={message} />

      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar cliente"
        description={deleting?.name}
        warning={`Se eliminará el cliente ${deleting?.name ?? ""}. Solo se puede eliminar si no tiene entregas registradas.`}
        action={() => (deleting ? deleteClientAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin cliente." }))}
        onClose={() => setDeleting(undefined)}
        onDone={flash}
      />

      <SlideOver
        open={detail !== undefined}
        onOpenChange={(next) => !next && setDetailId(null)}
        title={detail?.name ?? "Cliente"}
        description={detail?.address ?? undefined}
      >
        {detail && <ClientDetail client={detail} />}
      </SlideOver>

      <SlideOver
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Editar cliente" : "Nuevo cliente"}
        description={editing?.name}
      >
        <ClientForm
          client={editing}
          onCancel={() => setFormOpen(false)}
          onDone={(msg) => {
            flash(msg);
            setFormOpen(false);
          }}
        />
      </SlideOver>
    </section>
  );
}
