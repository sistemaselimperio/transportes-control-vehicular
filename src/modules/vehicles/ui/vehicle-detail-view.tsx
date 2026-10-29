import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusMark } from "@/components/app/status-mark";
import { VehicleLogbookSection } from "@/modules/logbook/ui/vehicle-logbook";
import { StatusPill } from "@/modules/alerts/ui/status-pill";
import { VehicleFilesPanel } from "@/modules/documents/ui/vehicle-files-panel";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import type { VehicleDetail } from "../application/vehicle-queries";
import { technicalGroups } from "../domain/technical-data";
import { formatKm, type VehicleGridRow } from "../domain/vehicle-row";
import { Section, SubHeading } from "./file-section";
import { PeoplePopover } from "./people-popover";
import { TabParamScroll } from "./tab-param-scroll";
import {
  ActionButtons,
  EditDataButton,
  FileActions,
  SellButton,
  SoldNotice,
  StatusSwitch,
} from "./vehicle-file-actions";

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
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            <p className="truncate text-lg leading-tight font-semibold tracking-tight">
              {r.brandLine ?? <span className="font-normal text-muted-foreground">Sin marca registrada</span>}
            </p>
            <PeoplePopover driverName={r.driverName} driverPhone={r.driverPhone} ownerName={r.ownerName} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 max-sm:w-full [&_button:not(:disabled)]:cursor-pointer">
          <StatusSwitch />
          <EditDataButton />
          <ActionButtons keys={["owner"]} />
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
 * how far it has gone; then its papers; then the logbook; and last the
 * notes. The only overlays are the action forms, which `readOnly` removes along with every write control.
 */
export function VehicleDetailView({ detail, readOnly = false }: { detail: VehicleDetail; readOnly?: boolean }) {
  const r = detail.row;
  const sold = r.vehicleStatus === "SOLD";

  return (
    <FileActions
      plate={r.plate}
      status={r.vehicleStatus}
      ctx={detail.actions}
      edit={detail.edit}
      technical={r.technical}
      current={{ owner: r.ownerName, driver: r.driverName }}
      readOnly={readOnly}
    >
      <TabParamScroll />
      <div className="space-y-10">
        <div className="space-y-6">
          <FileHeader r={r} />
          {sold && <SoldNotice />}
        </div>

        <Section id="datos-tecnicos" title="Datos técnicos">
          <TechnicalSheet r={r} />
        </Section>

        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
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

        <VehicleLogbookSection plate={r.plate} logbook={detail.logbook} canManage={!readOnly} />

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
