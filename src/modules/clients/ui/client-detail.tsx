"use client";

import { CheckCircle2, Copy, ExternalLink, MapPin, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useFlashMessage } from "@/components/app/flash-message";
import { StatusMark } from "@/components/app/status-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatNit } from "@/modules/petty-cash/domain/nit";
import { ConfirmDeleteDialog } from "@/modules/petty-cash/ui/confirm-delete-dialog";
import { deleteLocationAction, updateClientAction } from "../application/client-actions";
import type { ClientLocationRow } from "../domain/client-location";
import { missingLocationCount, type ClientRow } from "../domain/client-row";
import { buildMapsLink, buildWhatsAppShareUrl } from "../domain/maps-link";
import { ClientFields } from "./client-fields";
import { InlineForm } from "./inline-form";
import { LocationForm } from "./location-form";

/** Moves focus back to `target` when an editor that was open closes. */
function useReturnFocus(open: boolean, target: RefObject<HTMLElement | null>) {
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) target.current?.focus();
    wasOpen.current = open;
  }, [open, target]);
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 border-b py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "mt-0.5 text-sm font-medium break-words" : "mt-0.5 text-sm text-muted-foreground"}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

/** The client's data: read view, swapped in place for the form while editing. */
function DataSection({
  client,
  canManage,
  startEditing,
  onSaved,
}: {
  client: ClientRow;
  canManage: boolean;
  startEditing: boolean;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState(startEditing && canManage);
  const editRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useReturnFocus(editing, editRef);

  // Wait a frame so the sheet's own focus handling does not take focus back.
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  return (
    <section aria-labelledby={`client-${client.id}-data`} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`client-${client.id}-data`} className="micro-label">
          Datos
        </h3>
        {canManage && !editing && (
          <Button ref={editRef} variant="outline" className="h-11 px-4 md:h-9" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Editar
          </Button>
        )}
      </div>
      {editing ? (
        <InlineForm
          action={(fd) => updateClientAction(client.id, fd)}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
          onDone={(message) => {
            onSaved(message);
            setEditing(false);
          }}
        >
          <ClientFields client={client} firstFieldRef={nameRef} />
        </InlineForm>
      ) : (
        <dl>
          <Detail label="NIT" value={client.nit ? formatNit(client.nit) : null} />
          <Detail label="Teléfono" value={client.phone} />
          <Detail label="Notas" value={client.notes} />
          <Detail label="Entregas registradas" value={String(client.deliveryCount)} />
        </dl>
      )}
    </section>
  );
}

/** One finca: name, address, status and, when ready, the short bar to hand it to a driver. */
function LocationItem({
  client,
  location,
  canManage,
  editing,
  onEdit,
  onCloseEditor,
  onDelete,
  onSaved,
}: {
  client: ClientRow;
  location: ClientLocationRow;
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
  onCloseEditor: () => void;
  onDelete: () => void;
  onSaved: (message: string) => void;
}) {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editRef = useRef<HTMLButtonElement>(null);
  const link = buildMapsLink(location);
  useReturnFocus(editing, editRef);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 4000);
  }

  if (editing) {
    return (
      <li className="space-y-3 rounded-xl border bg-card p-3">
        <p className="text-sm font-medium break-words">Editar finca {location.name}</p>
        <LocationForm
          clientId={client.id}
          location={location}
          onCancel={onCloseEditor}
          onDone={(message) => {
            onSaved(message);
            onCloseEditor();
          }}
        />
      </li>
    );
  }

  return (
    <li className="space-y-2.5 rounded-xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{location.name}</p>
          <p className="text-sm break-words text-muted-foreground">{location.address ?? "Sin dirección"}</p>
        </div>
        <StatusMark status={link ? "ok" : "warning"} className="mt-0.5">
          {link ? "Lista" : "Sin ubicación"}
        </StatusMark>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <>
            <a
              href={buildWhatsAppShareUrl({
                clientName: client.name,
                locationName: location.name,
                address: location.address,
                link,
              })}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Compartir finca ${location.name} por WhatsApp`}
              className={buttonVariants({ className: "h-11 px-3 md:h-9" })}
            >
              <MessageCircle aria-hidden />
              WhatsApp
            </a>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir finca ${location.name} en Maps`}
              className={buttonVariants({ variant: "outline", className: "h-11 px-3 md:h-9" })}
            >
              <MapPin aria-hidden />
              Maps
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <Button
              variant="outline"
              className="h-11 px-3 md:h-9"
              aria-label={`Copiar link de la finca ${location.name}`}
              onClick={copyLink}
            >
              <Copy aria-hidden />
              Copiar
            </Button>
          </>
        ) : (
          canManage && (
            <Button variant="outline" className="h-11 px-3 md:h-9" onClick={onEdit}>
              <MapPin aria-hidden />
              Agregar ubicación
              <span className="sr-only"> a la finca {location.name}</span>
            </Button>
          )
        )}
        {canManage && (
          <div className="ml-auto flex shrink-0 items-center">
            <Button
              ref={editRef}
              variant="ghost"
              size="icon"
              className="size-11 md:size-9"
              aria-label={`Editar finca ${location.name}`}
              title="Editar"
              onClick={onEdit}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-destructive md:size-9"
              aria-label={`Eliminar finca ${location.name}`}
              title="Eliminar"
              onClick={onDelete}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
        {copied === "done" && "Link copiado."}
        {copied === "failed" && "No se pudo copiar. Mantén presionado el link para copiarlo."}
      </p>
      {copied === "failed" && link && <p className="text-xs break-all text-muted-foreground">{link}</p>}
    </li>
  );
}

/** The fincas of the client: compact rows, one editor open at a time. */
function LocationsSection({
  client,
  canManage,
  onSaved,
}: {
  client: ClientRow;
  canManage: boolean;
  onSaved: (message: string) => void;
}) {
  // "new" is the add form; a number is the id of the finca being edited.
  const [editor, setEditor] = useState<"new" | number | null>(null);
  const [deleting, setDeleting] = useState<ClientLocationRow | undefined>();
  const addRef = useRef<HTMLButtonElement>(null);
  useReturnFocus(editor === "new", addRef);
  const missing = missingLocationCount(client);

  return (
    <section aria-labelledby={`client-${client.id}-locations`} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`client-${client.id}-locations`} className="micro-label">
            Fincas ({client.locations.length})
          </h3>
          {missing > 0 && <p className="text-sm font-medium text-warn-foreground">{missing} sin ubicación</p>}
        </div>
        {canManage && (
          <Button
            ref={addRef}
            variant="outline"
            className="h-11 px-4 md:h-9"
            disabled={editor === "new"}
            onClick={() => setEditor("new")}
          >
            <Plus aria-hidden />
            Agregar finca
          </Button>
        )}
      </div>

      {client.locations.length === 0 && editor !== "new" ? (
        <p className="text-sm text-muted-foreground">Este cliente no tiene fincas registradas.</p>
      ) : (
        <ul className="space-y-3">
          {editor === "new" && (
            <li className="space-y-3 rounded-xl border bg-card p-3">
              <p className="text-sm font-medium">Nueva finca</p>
              <LocationForm
                clientId={client.id}
                onCancel={() => setEditor(null)}
                onDone={(message) => {
                  onSaved(message);
                  setEditor(null);
                }}
              />
            </li>
          )}
          {client.locations.map((location) => (
            <LocationItem
              key={location.id}
              client={client}
              location={location}
              canManage={canManage}
              editing={editor === location.id}
              onEdit={() => setEditor(location.id)}
              onCloseEditor={() => setEditor(null)}
              onDelete={() => setDeleting(location)}
              onSaved={onSaved}
            />
          ))}
        </ul>
      )}

      {/* Rendered inside the sheet's dialog, so base-ui stacks it as a nested dialog and the sheet stays open. */}
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        title="Eliminar finca"
        description={deleting && `${client.name} · ${deleting.name}`}
        warning={`Se eliminará la finca ${deleting?.name ?? ""}. Las entregas que la usaban quedan sin finca.`}
        action={() => (deleting ? deleteLocationAction(deleting.id) : Promise.resolve({ ok: false as const, error: "Sin finca." }))}
        onClose={() => setDeleting(undefined)}
        onDone={onSaved}
      />
    </section>
  );
}

/** The client sheet: its data and its fincas, both editable in place. */
export function ClientDetail({
  client,
  canManage,
  startEditing,
}: {
  client: ClientRow;
  canManage: boolean;
  /** Opens the data section already in edit mode. */
  startEditing: boolean;
}) {
  // The page toast sits under the sheet's backdrop, so saves are confirmed inside the sheet.
  const { message, flash } = useFlashMessage(5000);

  return (
    <div className="space-y-6">
      <p
        role="status"
        className="flex items-center gap-2 rounded-xl border border-ok-foreground/20 bg-ok px-3 py-2 text-sm text-ok-foreground empty:hidden"
      >
        {message && (
          <>
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {message}
          </>
        )}
      </p>
      <DataSection client={client} canManage={canManage} startEditing={startEditing} onSaved={flash} />
      <LocationsSection client={client} canManage={canManage} onSaved={flash} />
    </div>
  );
}
