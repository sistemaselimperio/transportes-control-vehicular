import { ArrowLeft, Link2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusMark } from "@/components/app/status-mark";
import { logbookHref, logbookTabsFor } from "@/modules/logbook/domain/logbook";
import { VehicleLogbookPanel } from "@/modules/logbook/ui/vehicle-logbook";
import { VehicleTripsList } from "@/modules/trips/ui/vehicle-trips-list";
import type { TripRow } from "@/modules/trips/domain/trip-row";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { VehicleInspectionsList } from "@/modules/inspections/ui/vehicle-inspections-list";
import { VehicleFilesPanel } from "@/modules/documents/ui/vehicle-files-panel";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { canTowTrailer, isTrailerClass } from "../domain/trailer";
import type { VehicleInspectionRow } from "@/modules/inspections/infrastructure/inspection-repository";
import type { VehicleDetail } from "../application/vehicle-queries";
import type { HistoryTab } from "../domain/history-tab";
import { technicalGroups } from "../domain/technical-data";
import { formatKm, type VehicleGridRow } from "../domain/vehicle-row";
import { Section, SubHeading } from "./file-section";
import { VehicleHistorySection } from "./vehicle-history-section";
import { PeoplePopover } from "./people-popover";
import { TabParamScroll } from "./tab-param-scroll";
import {
  ActionButtons,
  EditDataButton,
  FileActions,
  InlineAction,
  SellButton,
  SoldNotice,
  StatusSwitch,
  type ActionKey,
} from "./vehicle-file-actions";
import { PlateText } from "@/components/app/plate-text";

/** One labelled value of the technical sheet; a missing value reads as a muted dash. */
function Spec({ label, value }: { label: string; value: string }) {
  const missing = value === "—";
  return (
    <div className="min-w-0 border-b py-2">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm ${missing ? "text-muted-foreground" : "font-medium"}`}
        title={missing ? undefined : value}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The vehicle's technical sheet in two titled groups side by side, each two rows deep on a wide
 * screen: what identifies it, then what describes it. Every field keeps its place, so a missing one is easy to spot.
 */
function TechnicalSheet({ r }: { r: VehicleGridRow }) {
  const [identification, characteristics] = technicalGroups(r.technical);
  const registry = [
    { label: "Municipio", value: r.municipality ?? "—" },
    { label: "Servicio", value: r.serviceLabel },
  ];
  const groups = [
    {
      title: identification.title,
      known: identification.known + registry.filter((x) => x.value !== "—").length,
      rows: [...registry, ...identification.rows],
      cols: "sm:grid-cols-3",
    },
    { ...characteristics, cols: "sm:grid-cols-3" },
  ];
  return (
    <div className="grid gap-x-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)]">
      {groups.map((group) => (
        <div key={group.title} className="min-w-0">
          <SubHeading count={group.known}>{group.title}</SubHeading>
          <dl className={`grid grid-cols-2 gap-x-6 ${group.cols}`}>
            {group.rows.map((row) => (
              <Spec key={row.label} {...row} />
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

const kmText = (r: VehicleGridRow) =>
  r.km != null ? formatKm(r.km) : r.odometerWorking ? "—" : "Odómetro dañado";

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

/** One maintenance figure: label above, value at a reading size. */
function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-b py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base font-medium">{children}</dd>
    </div>
  );
}

/** Header of a trailer: only its plate, its owner and the tractor it is anchored to. */
function TrailerHeader({ r, towedByPlate }: { r: VehicleGridRow; towedByPlate: string | null }) {
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
        <h1 className="plate plate-lg"><PlateText plate={r.plate} /></h1>
        <div className="min-w-0 flex-1 basis-56">
          {r.className && <p className="micro-label">{r.className}</p>}
          <p className="mt-0.5 truncate text-lg leading-tight font-semibold tracking-tight">
            {r.ownerName ?? <span className="font-normal text-muted-foreground">Sin propietario</span>}
          </p>
          {towedByPlate ? (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="size-3.5 shrink-0" aria-hidden />
              Anclado a
              <Link
                href={fileHref(towedByPlate)}
                className="plate rounded-[5px] outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
                title={`Ver la ficha de ${towedByPlate}`}
              >
                <PlateText plate={towedByPlate} />
              </Link>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">Sin anclar a un vehículo</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 max-sm:w-full [&_button:not(:disabled)]:cursor-pointer">
          <StatusSwitch />
          <EditDataButton />
          <ActionButtons keys={["owner"]} iconOnly={["owner"]} />
          <SellButton />
        </div>
      </div>
    </header>
  );
}

const fileHref = (plate: string) => `/flota/${encodeURIComponent(plate)}`;

/**
 * The trailer this vehicle pulls: its plate as a chip that opens the trailer's file, with a quiet
 * "Cambiar". Anchoring a first one is a header action instead (see `FileHeader`).
 */
function TrailerLink({ trailerPlate }: { trailerPlate: string }) {
  return (
    <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-2.5">
      <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="micro-label">Remolque</span>
      <Link
        href={fileHref(trailerPlate)}
        className="plate rounded-[5px] outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/70"
        title={`Ver la ficha del remolque ${trailerPlate}`}
      >
        <PlateText plate={trailerPlate} />
      </Link>
      <InlineAction action="trailer">Cambiar</InlineAction>
    </div>
  );
}

function FileHeader({ r, trailerPlate }: { r: VehicleGridRow; trailerPlate: string | null }) {
  // Only trucks and tractor units pull a trailer: the others get no anchor action at all.
  const canAnchor = !trailerPlate && canTowTrailer(r.className ?? "");
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
        <h1 className="plate plate-lg"><PlateText plate={r.plate} /></h1>
        <div className="min-w-0 flex-1 basis-56">
          {r.className && <p className="micro-label">{r.className}</p>}
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            <p className="truncate text-lg leading-tight font-semibold tracking-tight">
              {r.brandLine ?? <span className="font-normal text-muted-foreground">Sin marca registrada</span>}
            </p>
            <PeoplePopover driverName={r.driverName} driverPhone={r.driverPhone} ownerName={r.ownerName} />
          </div>
          {trailerPlate && <TrailerLink trailerPlate={trailerPlate} />}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 max-sm:w-full [&_button:not(:disabled)]:cursor-pointer">
          <StatusSwitch />
          <EditDataButton />
          <ActionButtons keys={canAnchor ? ["trailer", "owner"] : ["owner"]} iconOnly={["owner"]} />
          <SellButton />
        </div>
      </div>
      <ExpirationStrip r={r} />
    </header>
  );
}

/**
 * Vehicle file ordered by what the dispatcher needs first: identity, status and expiries in the
 * header; then the technical sheet that says exactly which vehicle this is; then who runs it and
 * how far it has gone; then its papers; then its history (inspections, trips, logbook); and last the
 * notes. The only overlays are the action forms, which `readOnly` removes along with every write control.
 */
export function VehicleDetailView({
  detail,
  readOnly = false,
  allowed,
  inspections = [],
  trips = [],
  historyTab = "bitacora",
}: {
  detail: VehicleDetail;
  /** Latest pre-operational inspections of this vehicle, newest first; read per request, not cached. */
  inspections?: readonly VehicleInspectionRow[];
  /** Latest trips of this vehicle, newest start first. */
  trips?: readonly TripRow[];
  /** Tab of the Historial section the page opens on. */
  historyTab?: HistoryTab;
  readOnly?: boolean;
  /** Actions a read-only user may still run (see `FileActions`). */
  allowed?: readonly ActionKey[];
}) {
  const r = detail.row;
  const sold = r.vehicleStatus === "SOLD";
  const isTrailer = isTrailerClass(r.className ?? "");

  if (isTrailer) {
    return (
      <FileActions
        plate={r.plate}
        status={r.vehicleStatus}
        ctx={detail.actions}
        edit={detail.edit}
        towing={detail.towing}
        technical={r.technical}
        current={{ owner: r.ownerName, driver: null }}
        readOnly={readOnly}
        allowed={allowed}
      >
        <div className="space-y-10">
          <div className="space-y-6">
            <TrailerHeader r={r} towedByPlate={detail.towing.towedByPlate} />
            {sold && <SoldNotice />}
          </div>
          {/* Trailers have no technical sheet or documents to track, but their maintenance is kept. */}
          <Section
            id="bitacora"
            title="Bitácora"
            actions={
              // Staff cannot open the Bitácora page, so they get no link to it.
              !readOnly && (
                <Link
                  href={logbookHref(r.plate, "servicios")}
                  className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-4 transition-colors duration-150 hover:text-foreground md:min-h-7"
                >
                  Ver bitácora
                </Link>
              )
            }
          >
            <VehicleLogbookPanel logbook={detail.logbook} tabs={logbookTabsFor({ isTrailer: true })} />
          </Section>
        </div>
      </FileActions>
    );
  }

  return (
    <FileActions
      plate={r.plate}
      status={r.vehicleStatus}
      ctx={detail.actions}
      edit={detail.edit}
      towing={detail.towing}
      technical={r.technical}
      current={{ owner: r.ownerName, driver: r.driverName }}
      readOnly={readOnly}
      allowed={allowed}
    >
      <TabParamScroll />
      <div className="space-y-10">
        <div className="space-y-6">
          <FileHeader r={r} trailerPlate={detail.towing.trailerPlate} />
          {sold && <SoldNotice />}
        </div>

        <Section id="datos-tecnicos" title="Datos técnicos">
          <TechnicalSheet r={r} />
        </Section>

        {/* Documents get one share more than maintenance: their cards sit three to a row. */}
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[5fr_7fr]">
          <div className="min-w-0">
            <Section id="mantenimiento" title="Mantenimiento" actions={<ActionButtons keys={["oil", "km"]} />}>
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <Figure label="Kilometraje">
                  <span className="num">{kmText(r)}</span>
                  {r.km != null && <span className="ml-1 text-sm font-normal text-muted-foreground">km</span>}
                </Figure>
                <Figure label="Último cambio de aceite">
                  <span className="num">{r.lastOilDate ? formatDisplayDate(r.lastOilDate) : "—"}</span>
                </Figure>
                <Figure label="Próximo cambio de aceite">
                  <StatusMark status={r.nextChange.status} className="whitespace-normal">
                    {r.nextChange.text || "—"}
                  </StatusMark>
                </Figure>
              </dl>
            </Section>
          </div>
          <div className="min-w-0 max-lg:border-t max-lg:pt-8 lg:border-l lg:pl-10">
            <Section
              id="documentos"
              title="Documentos"
              note={`${detail.files.length} ${detail.files.length === 1 ? "archivo" : "archivos"}`}
              actions={<ActionButtons keys={["document", "tax"]} primary="document" />}
            >
              <VehicleFilesPanel plate={r.plate} files={detail.files} readOnly={readOnly} />
            </Section>
          </div>
        </div>

        <VehicleHistorySection
          initialTab={historyTab}
          panels={{
            preoperacionales: <VehicleInspectionsList rows={inspections} />,
            viajes: <VehicleTripsList rows={trips} />,
            bitacora: <VehicleLogbookPanel logbook={detail.logbook} />,
          }}
          links={{
            preoperacionales: { href: `/preoperacionales?vehiculo=${r.id}`, label: "Ver preoperacionales" },
            viajes: { href: `/viajes?${new URLSearchParams({ placa: r.plate })}`, label: "Ver viajes" },
            // Staff cannot open the Bitácora page, so they get no link to it.
            bitacora: readOnly ? null : { href: logbookHref(r.plate, "servicios"), label: "Ver bitácora" },
          }}
        />

        {(r.notes || detail.sale) && (
          <Section id="notas" title={detail.sale ? "Notas y venta" : "Notas"}>
            {r.notes && <p className="border-b py-2.5 text-sm whitespace-pre-line">{r.notes}</p>}
            {detail.sale && (
              <p className="border-b py-2.5 text-sm">
                <span className="font-medium">Venta: {detail.sale.title}</span>
                <span className="text-muted-foreground"> · {detail.sale.detail}</span>
              </p>
            )}
          </Section>
        )}
      </div>
    </FileActions>
  );
}
