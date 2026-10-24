import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusMark } from "@/components/app/status-mark";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { VehicleFilesPanel } from "@/modules/documents/ui/vehicle-files-panel";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { HistoryItem, VehicleDetail } from "../application/vehicle-queries";
import { formatKm, type VehicleGridRow } from "../domain/vehicle-row";
import { TabParamScroll } from "./tab-param-scroll";
import {
  ActionButtons,
  EditDataButton,
  FileActions,
  SellButton,
  SoldNotice,
  StatusSwitch,
} from "./vehicle-file-actions";

/** A register section: the heading row carries one bottom rule and the section's own actions. */
function Section({
  id,
  title,
  note,
  actions,
  children,
}: {
  id?: string;
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {note && <span className="num text-sm text-muted-foreground">{note}</span>}
        {actions && <div className="max-md:order-last max-md:basis-full md:ml-auto">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Small heading for a list inside a section. */
const SubHeading = ({ children, count }: { children: ReactNode; count: number }) => (
  <h3 className="mt-5 flex items-baseline gap-2 border-b pb-1.5 text-sm font-semibold">
    {children}
    <span className="num font-normal text-muted-foreground">{count}</span>
  </h3>
);

/** Label muted on the left, value on the right, one thin rule per row. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-baseline justify-between gap-4 border-b py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** A figure with its label above, in a strip split by hairlines (no tile). */
function Figure({ label, children, lead = false }: { label: string; children: ReactNode; lead?: boolean }) {
  return (
    <div className="min-w-0 border-b py-3 sm:border-b-0 sm:py-4 sm:pr-6 sm:pl-6 sm:first:pl-0 sm:[&:not(:first-child)]:border-l">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`num mt-1 ${lead ? "text-[1.75rem] leading-8 font-semibold" : "text-base font-medium"}`}>
        {children}
      </dd>
    </div>
  );
}

const Empty = ({ children = "Sin registros." }: { children?: ReactNode }) => (
  <p className="border-b py-2.5 text-sm text-muted-foreground">{children}</p>
);

function DriverValue({ r }: { r: VehicleGridRow }) {
  return (
    <>
      {r.driverName ?? "—"}
      {r.driverPhone && (
        <>
          {" · "}
          <a
            href={`tel:${r.driverPhone}`}
            className="num inline-flex min-h-11 items-center underline decoration-muted-foreground/60 decoration-1 underline-offset-4 md:min-h-0"
          >
            {r.driverPhone}
          </a>
        </>
      )}
    </>
  );
}

const kmText = (r: VehicleGridRow) =>
  r.km != null ? formatKm(r.km) : r.odometerWorking ? "—" : "Odómetro dañado";

/** Every record of a list, title left and detail right, one rule per line. */
function Records({ items, empty = "Sin registros." }: { items: HistoryItem[]; empty?: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b py-2 text-sm">
          <span className="num font-medium">{item.title}</span>
          <span className="text-muted-foreground">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Expiry cards at the top of the file: one card per document plus the next oil change. */
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
      className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5"
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
    <header className="space-y-2 border-b pb-4">
      <Link
        href="/flota"
        className="group/back inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground md:min-h-8"
      >
        <ArrowLeft
          className="size-4 transition-transform duration-150 group-hover/back:-translate-x-0.5"
          aria-hidden
        />
        Flota
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="plate plate-lg">{r.plate}</h1>
        <div className="min-w-0 flex-1 basis-56">
          {r.className && <p className="micro-label">{r.className}</p>}
          <p className="mt-1.5 truncate text-lg leading-tight font-semibold tracking-tight">
            {r.brandLine ?? <span className="font-normal text-muted-foreground">Sin marca registrada</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 max-sm:w-full">
          <StatusSwitch />
          <EditDataButton />
          <SellButton />
        </div>
      </div>
      <ExpirationStrip r={r} />
    </header>
  );
}

/**
 * Vehicle file as the truck's paper folder, kept as a ledger: documents on a shared expiry axis
 * with their files inline, then maintenance, with people and the ficha beside (stacked on phones).
 * Everything is visible on the page; the only overlays are the action forms.
 */
export function VehicleDetailView({ detail }: { detail: VehicleDetail }) {
  const r = detail.row;
  const sold = r.vehicleStatus === "SOLD";

  return (
    <FileActions
      plate={r.plate}
      status={r.vehicleStatus}
      ctx={detail.actions}
      edit={detail.edit}
      current={{ owner: r.ownerName, driver: r.driverName }}
    >
      <TabParamScroll />
      <div className="space-y-6">
        <FileHeader r={r} />
        {sold && <SoldNotice />}

        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,44rem)_minmax(21rem,1fr)] lg:items-start">
          <div className="min-w-0 space-y-8">
            <Section
              id="documentos"
              title="Documentos"
              note={`${detail.files.length} ${detail.files.length === 1 ? "archivo" : "archivos"}`}
              actions={<ActionButtons keys={["document", "tax"]} primary="document" />}
            >
              <VehicleFilesPanel plate={r.plate} files={detail.files} />
            </Section>

            <Section id="mantenimiento" title="Mantenimiento" actions={<ActionButtons keys={["oil", "km"]} />}>
              <dl className="grid sm:grid-cols-3">
                <Figure label="Kilometraje" lead>
                  {kmText(r)}
                  {r.km != null && <span className="ml-1 text-sm font-normal text-muted-foreground">km</span>}
                </Figure>
                <Figure label="Último cambio de aceite">
                  {r.lastOilDate ? formatDisplayDate(r.lastOilDate) : "—"}
                </Figure>
                <Figure label="Próximo cambio de aceite">
                  <span className="font-sans">
                    <StatusMark status={r.nextChange.status}>{r.nextChange.text || "—"}</StatusMark>
                  </span>
                </Figure>
              </dl>
              <SubHeading count={detail.oilChanges.length}>Cambios de aceite</SubHeading>
              <Records items={detail.oilChanges} />
            </Section>
          </div>

          <aside className="min-w-0 space-y-8 max-lg:border-t max-lg:pt-8 lg:self-stretch lg:border-l lg:pl-10">
            <Section id="personas" title="Personas" actions={<ActionButtons keys={["driver", "owner"]} />}>
              <dl>
                <Row label="Propietario">{r.ownerName ?? "Sin propietario"}</Row>
                <Row label="Conductor">
                  <DriverValue r={r} />
                </Row>
              </dl>
              <SubHeading count={detail.ownerships.length}>Propietarios anteriores</SubHeading>
              <Records items={detail.ownerships} />
              <SubHeading count={detail.drivers.length}>Conductores anteriores</SubHeading>
              <Records items={detail.drivers} />
            </Section>

            <Section title="Ficha">
              <dl>
                <Row label="Municipio">{r.municipality ?? "—"}</Row>
                <Row label="Servicio">{r.serviceLabel}</Row>
              </dl>
              {r.notes && (
                <>
                  <h3 className="mt-5 border-b pb-1.5 text-sm font-semibold">Notas</h3>
                  <p className="border-b py-2.5 text-sm whitespace-pre-line">{r.notes}</p>
                </>
              )}
              {detail.sale && (
                <>
                  <h3 className="mt-5 border-b pb-1.5 text-sm font-semibold">Venta</h3>
                  <p className="border-b py-2.5 text-sm">
                    <span className="font-medium">{detail.sale.title}</span>
                    <span className="text-muted-foreground"> · {detail.sale.detail}</span>
                  </p>
                </>
              )}
            </Section>
          </aside>
        </div>
      </div>
    </FileActions>
  );
}
