"use client";

import { Plus, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { FlashMessage, useFlashMessage } from "@/components/app/flash-message";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { deleteClientAction } from "../application/client-actions";
import { filterClientList, missingLocationCount, type ClientRow } from "../domain/client-row";
import { ClientDetail } from "./client-detail";
import { ClientForm } from "./client-form";
import { ClientList } from "./client-list";

/** Clients page: search and filter, the list, the client sheet (data and fincas in place), the create sheet and the delete confirmation. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The sheet's subline: what identifies the client and how much it is used, instead of the mode it is in. */
function clientSummary(client: ClientRow): string {
  return [
    client.nit ? `NIT ${formatNit(client.nit)}` : null,
    plural(client.locations.length, "finca", "fincas"),
    plural(client.deliveryCount, "entrega", "entregas"),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ClientsView({ rows, canManage }: { rows: readonly ClientRow[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The open client sheet; `edit` opens its data section straight in edit mode.
  const [sheet, setSheet] = useState<{ id: number; edit: boolean } | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | undefined>();
  const { message, flash } = useFlashMessage();

  const shown = useMemo(() => filterClientList(rows, query, missingOnly), [rows, query, missingOnly]);
  const withMissing = useMemo(() => rows.filter((r) => missingLocationCount(r) > 0).length, [rows]);
  // Read the client from the fresh rows, so a save shows right away.
  const detail = sheet === null ? undefined : rows.find((r) => r.id === sheet.id);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Clientes del área comercial y las fincas donde se les entrega."
        actions={
          canManage && (
            <Button className="h-11 px-4 md:h-10" onClick={() => setCreateOpen(true)}>
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
        <Button
          type="button"
          variant={missingOnly ? "default" : "outline"}
          aria-pressed={missingOnly}
          className="h-11 px-3 md:h-9"
          onClick={() => setMissingOnly((on) => !on)}
        >
          <TriangleAlert aria-hidden />
          Con fincas sin ubicación
          <span className="num">({withMissing})</span>
        </Button>
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {shown.length} de {rows.length} clientes
        </p>
      </div>

      <ClientList
        rows={shown}
        canManage={canManage}
        missingOnly={missingOnly}
        onOpen={(row) => setSheet({ id: row.id, edit: false })}
        onEdit={(row) => setSheet({ id: row.id, edit: true })}
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

      {/* Opening a client only shows it; data and fincas are changed only when entering through Editar. */}
      <SlideOver
        open={detail !== undefined}
        onOpenChange={(next) => !next && setSheet(null)}
        title={detail?.name ?? "Cliente"}
        description={detail && clientSummary(detail)}
      >
        {detail && (
          <ClientDetail
            key={`${detail.id}-${sheet?.edit ? "edit" : "view"}`}
            client={detail}
            canManage={canManage && (sheet?.edit ?? false)}
            startEditing={sheet?.edit ?? false}
          />
        )}
      </SlideOver>

      <SlideOver open={createOpen} onOpenChange={setCreateOpen} title="Nuevo cliente">
        <ClientForm
          onCancel={() => setCreateOpen(false)}
          onDone={(msg) => {
            flash(msg);
            setCreateOpen(false);
          }}
        />
      </SlideOver>
    </section>
  );
}
