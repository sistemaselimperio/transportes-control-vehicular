"use client";

import { CheckCircle2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { DeleteAllButton } from "@/components/app/delete-all-button";
import { PageHeader } from "@/components/app/page-header";
import { SlideOver } from "@/components/app/slide-over";
import { TabBar } from "@/components/app/tab-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GROUP_LABELS, type OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";
import { deleteAllOwnersAction } from "../application/owner-actions";
import {
  countOwnerViews,
  filterOwnerRows,
  OWNER_VIEWS,
  type OwnerRow,
  type OwnerView,
} from "../domain/owner-row";
import { OwnerForm } from "./owner-form";
import { OwnerList } from "./owner-list";

/** Keeps the tab in the URL so the list can be shared or reloaded. */
function syncUrl(view: OwnerView) {
  const url = new URL(window.location.href);
  if (view === "WITH_VEHICLES") url.searchParams.set("vista", "con-vehiculos");
  else url.searchParams.delete("vista");
  window.history.replaceState(null, "", url);
}

/** Owners page: tabs, search, the list and the create / edit side sheet. */
export function OwnersView({
  rows,
  group,
  initialView,
}: {
  rows: readonly OwnerRow[];
  group: OwnerGroup | null;
  initialView: OwnerView;
}) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerRow | undefined>();
  const [message, setMessage] = useState<string | null>(null);

  const counts = countOwnerViews(rows, query);
  const visible = filterOwnerRows(rows, { view, query });

  const openForm = (owner?: OwnerRow) => {
    setMessage(null);
    setEditing(owner);
    setOpen(true);
  };

  function selectView(next: OwnerView) {
    setView(next);
    syncUrl(next);
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Propietarios"
        description={`Dueños de los vehículos y los vehículos que tienen hoy${group ? ` · ${GROUP_LABELS[group]}` : ""}.`}
        actions={
          <>
            <DeleteAllButton count={rows.length} title="Eliminar todos los propietarios" action={deleteAllOwnersAction}>
              <p className="font-medium">Se eliminarán TODOS los propietarios, no solo los que ves en pantalla.</p>
              <p className="text-muted-foreground">
                Se quitan también los vínculos de propiedad con los vehículos. Los vehículos no se eliminan.
              </p>
            </DeleteAllButton>
            <Button className="h-11 px-4 md:h-10" onClick={() => openForm()}>
              <Plus aria-hidden />
              Nuevo propietario
            </Button>
          </>
        }
      />

      <TabBar
        label="Vista de propietarios"
        items={OWNER_VIEWS.map((v) => ({ key: v.key, label: v.label, count: counts[v.key] }))}
        active={view}
        onSelect={selectView}
        idPrefix="owner-tab"
        panelId="owner-panel"
        chips
      />

      <label className="relative block w-full sm:w-72">
        <span className="sr-only">Buscar por nombre o documento</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nombre o documento"
          autoComplete="off"
          className="h-11 pl-8 md:h-9"
        />
      </label>

      <div id="owner-panel" role="tabpanel" aria-labelledby={`owner-tab-${view}`}>
        <OwnerList
          rows={visible}
          empty={
            query === "" && view === "WITH_VEHICLES"
              ? "Ningún propietario tiene vehículos para este filtro."
              : "Ningún propietario coincide con la búsqueda."
          }
          onEdit={openForm}
        />
      </div>

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
        title={editing ? "Editar propietario" : "Nuevo propietario"}
        description={editing?.name}
      >
        <OwnerForm
          owner={editing}
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
