import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { HistoryItem, VehicleDetail } from "../application/vehicle-queries";
import type { FileTab } from "../domain/file-tabs";
import type { TimelineKind } from "../domain/vehicle-timeline";
import { formatKm, type VehicleGridRow } from "../domain/vehicle-row";
import { ActionButtons, EditDataButton, FileActions, OverflowMenu, SoldNotice } from "./vehicle-file-actions";
import { VehicleFileTabs } from "./vehicle-file-tabs";

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="plate-head">
        <h2 className="micro-label text-foreground">{title}</h2>
        {count !== undefined && <span className="num ml-auto text-sm text-muted-foreground">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

const FactGrid = ({ children, cols = "md:grid-cols-3" }: { children: ReactNode; cols?: string }) => (
  <dl className={`grid grid-cols-2 gap-x-4 gap-y-4 p-4 ${cols}`}>{children}</dl>
);

function History({ title, items }: { title: string; items: HistoryItem[] }) {
  return (
    <Panel title={title} count={items.length}>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Sin registros.</p>
      ) : (
        <ul className="divide-y text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
              <span className="font-medium">{item.title}</span>
              <span className="num text-muted-foreground">{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const KIND_LABELS: Record<TimelineKind, string> = {
  owner: "Propietario",
  driver: "Conductor",
  document: "Documento",
  oil: "Aceite",
  sale: "Venta",
};

function ExpirationStrip({ r }: { r: VehicleGridRow }) {
  const cells = [
    { label: "SOAT", cell: r.soat },
    { label: "Tecno", cell: r.tecno },
    { label: "Póliza", cell: r.policy },
    { label: "Impuesto", cell: r.tax },
    { label: "Aceite", cell: r.nextChange },
  ];
  return (
    <ul
      aria-label="Vencimientos"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5"
    >
      {cells.map(({ label, cell }, i) => (
        <li
          key={label}
          className={`min-w-0 bg-card px-3 py-2 ${i === cells.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
        >
          <span className="micro-label block">{label}</span>
          <StatusPill status={cell.status} className="mt-1.5">
            {cell.text || "—"}
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}

function FileHeader({ r }: { r: VehicleGridRow }) {
  return (
    <header className="space-y-3">
      <Link
        href="/flota"
        className="group/back inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground md:min-h-9"
      >
        <ArrowLeft
          className="size-4 transition-transform duration-150 group-hover/back:-translate-x-0.5"
          aria-hidden
        />
        Flota
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="plate plate-lg">{r.plate}</h1>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {[r.className, r.brandLine].filter(Boolean).join(" · ")}
          </p>
          <StatusPill status={r.overall} className="mt-1.5">
            {r.statusLabel}
          </StatusPill>
        </div>
        <EditDataButton />
        <OverflowMenu />
      </div>
      <ExpirationStrip r={r} />
    </header>
  );
}

/** Vehicle file: sticky identity header and five tabs, actions in a side panel. */
export function VehicleDetailView({ detail }: { detail: VehicleDetail }) {
  const r = detail.row;
  const sold = r.vehicleStatus === "SOLD";

  const panels: Record<FileTab, ReactNode> = {
    resumen: (
      <>
        <Panel title="Datos">
          <FactGrid>
            <Fact label="Propietario">{r.ownerName ?? "Sin propietario"}</Fact>
            <Fact label="Conductor">
              {r.driverName ?? "—"}
              {r.driverPhone && (
                <>
                  {" · "}
                  <a
                    href={`tel:${r.driverPhone}`}
                    className="num underline decoration-primary decoration-2 underline-offset-4"
                  >
                    {r.driverPhone}
                  </a>
                </>
              )}
            </Fact>
            <Fact label="Municipio">{r.municipality ?? "—"}</Fact>
            <Fact label="Servicio">{r.serviceLabel}</Fact>
            <Fact label="Kilometraje">
              <span className="num">
                {r.km != null ? formatKm(r.km) : r.odometerWorking ? "—" : "Odómetro dañado"}
              </span>
            </Fact>
            <Fact label="Último cambio de aceite">
              <span className="num">{r.lastOilDate ? formatDisplayDate(r.lastOilDate) : "—"}</span>
            </Fact>
          </FactGrid>
        </Panel>

        <Panel title="Vencimientos">
          <FactGrid cols="md:grid-cols-5">
            <Fact label="SOAT">
              <StatusPill status={r.soat.status}>{r.soat.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Tecnomecánica">
              <StatusPill status={r.tecno.status}>{r.tecno.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Póliza">
              <StatusPill status={r.policy.status}>{r.policy.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Impuesto">
              <StatusPill status={r.tax.status}>{r.tax.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Próximo cambio de aceite">
              <StatusPill status={r.nextChange.status}>{r.nextChange.text || "—"}</StatusPill>
            </Fact>
          </FactGrid>
        </Panel>

        {r.notes && (
          <Panel title="Notas">
            <p className="p-4 text-sm whitespace-pre-line">{r.notes}</p>
          </Panel>
        )}

        {detail.sale && (
          <Panel title="Venta">
            <p className="p-4 text-sm">
              <span className="font-medium">{detail.sale.title}</span>
              <span className="text-muted-foreground"> · {detail.sale.detail}</span>
            </p>
          </Panel>
        )}
        {sold && <SoldNotice />}
      </>
    ),

    documentos: (
      <>
        <ActionButtons keys={["document", "tax"]} />
        <Panel title="Vencimientos">
          <FactGrid cols="md:grid-cols-4">
            <Fact label="SOAT">
              <StatusPill status={r.soat.status}>{r.soat.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Tecnomecánica">
              <StatusPill status={r.tecno.status}>{r.tecno.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Póliza">
              <StatusPill status={r.policy.status}>{r.policy.text || "—"}</StatusPill>
            </Fact>
            <Fact label="Impuesto">
              <StatusPill status={r.tax.status}>{r.tax.text || "—"}</StatusPill>
            </Fact>
          </FactGrid>
        </Panel>
        <History title="Historial de documentos" items={detail.documents} />
      </>
    ),

    mantenimiento: (
      <>
        <ActionButtons keys={["oil", "km", "status"]} />
        <Panel title="Estado">
          <FactGrid>
            <Fact label="Kilometraje">
              <span className="num">
                {r.km != null ? formatKm(r.km) : r.odometerWorking ? "—" : "Odómetro dañado"}
              </span>
            </Fact>
            <Fact label="Último cambio de aceite">
              <span className="num">{r.lastOilDate ? formatDisplayDate(r.lastOilDate) : "—"}</span>
            </Fact>
            <Fact label="Próximo cambio de aceite">
              <StatusPill status={r.nextChange.status}>{r.nextChange.text || "—"}</StatusPill>
            </Fact>
          </FactGrid>
        </Panel>
        <History title="Cambios de aceite" items={detail.oilChanges} />
      </>
    ),

    personas: (
      <>
        <ActionButtons keys={["driver", "owner"]} />
        <Panel title="Actuales">
          <FactGrid cols="md:grid-cols-2">
            <Fact label="Propietario">{r.ownerName ?? "Sin propietario"}</Fact>
            <Fact label="Conductor">
              {r.driverName ?? "—"}
              {r.driverPhone && (
                <>
                  {" · "}
                  <a
                    href={`tel:${r.driverPhone}`}
                    className="num underline decoration-primary decoration-2 underline-offset-4"
                  >
                    {r.driverPhone}
                  </a>
                </>
              )}
            </Fact>
          </FactGrid>
        </Panel>
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <History title="Propietarios" items={detail.ownerships} />
          <History title="Conductores" items={detail.drivers} />
        </div>
      </>
    ),

    historial: (
      <Panel title="Todo el historial" count={detail.timeline.length}>
        {detail.timeline.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Sin registros.</p>
        ) : (
          <ol className="divide-y text-sm">
            {detail.timeline.map((entry, i) => (
              <li
                key={i}
                className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[6.5rem_6.5rem_1fr]"
              >
                <time className="num text-muted-foreground" dateTime={entry.date ?? undefined}>
                  {entry.date ? formatDisplayDate(entry.date) : "Sin fecha"}
                </time>
                <span className="micro-label">{KIND_LABELS[entry.kind]}</span>
                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="font-medium">{entry.title}</span>
                  {entry.detail && <span className="num text-muted-foreground"> · {entry.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    ),
  };

  return (
    <FileActions plate={r.plate} status={r.vehicleStatus} ctx={detail.actions} edit={detail.edit}>
      <VehicleFileTabs header={<FileHeader r={r} />} panels={panels} />
    </FileActions>
  );
}
