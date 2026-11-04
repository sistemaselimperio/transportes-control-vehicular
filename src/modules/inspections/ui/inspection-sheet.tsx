import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PREOPERATIONAL_CHECKLIST, itemNumber, type ChecklistItem } from "../domain/preoperational-checklist";
import { hasFailedItems } from "../domain/exit-decision";
import { uncheckedCount } from "../domain/preoperational-inspection";
import type { InspectionDetail } from "../infrastructure/inspection-repository";
import { ChecklistTable, FillingInstructions, LABEL_CELL, LEFT_COLUMN_SECTIONS, RULE, SheetHeader } from "./form-sheet";
import { NotRegisteredBadge } from "./inspection-badges";
import { DeleteInspectionButton } from "./delete-inspection-button";
import { ExitPanel, ExitSummary, type ExitPanelProps } from "./exit-panel";
import { formatInspectionDate, formatSheetDate, formatSheetTime, formatSignoff } from "./inspection-format";
import { PrintButton } from "./print-button";

const LINK = "underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/70";

/** Where the typed header points in the fleet and the drivers. Screen only: the printed sheet is the form. */
function RegisteredLinks({ inspection }: { inspection: InspectionDetail }) {
  const fleetLink = (plate: string) => (
    <Link href={`/flota/${encodeURIComponent(plate)}`} className={LINK}>
      Ficha de {plate}
    </Link>
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm print:hidden">
      <li className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Vehículo</span>
        {inspection.vehiclePlate ? fleetLink(inspection.vehiclePlate) : <NotRegisteredBadge>Placa no registrada</NotRegisteredBadge>}
      </li>
      {inspection.trailerPlate && (
        <li className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Remolque</span>
          {inspection.trailerRegisteredPlate ? (
            fleetLink(inspection.trailerRegisteredPlate)
          ) : (
            <NotRegisteredBadge>Placa no registrada</NotRegisteredBadge>
          )}
        </li>
      )}
      <li className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Conductor</span>
        {inspection.driverId ? (
          <>
            <span className="font-medium">{inspection.registeredDriverName}</span>
            <Link href={`/preoperacionales?conductor=${inspection.driverId}`} className={LINK}>
              Ver sus inspecciones
            </Link>
          </>
        ) : (
          <NotRegisteredBadge>Conductor no registrado</NotRegisteredBadge>
        )}
      </li>
    </ul>
  );
}

// Printing keeps the fills (dark header row, grey cells, yellow box, decision tints) like the PDF.
const EXACT = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";

/** The blank or marked square of the paper form. */
function Box({ checked, label }: { checked?: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center border-2 bg-white text-base leading-none font-black print:size-3 print:border print:text-[8px]",
        RULE,
      )}
    >
      {checked ? (
        <>
          <span aria-hidden>X</span>
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </span>
  );
}

/** One checklist row as printed: the chosen box carries an X, unanswered ones stay empty. */
function SheetRow({
  item,
  number,
  status,
  struck,
}: {
  item: ChecklistItem;
  number: string;
  status?: "BIEN" | "MAL";
  struck: boolean;
}) {
  return (
    <tr className="break-inside-avoid">
      <td className={cn("border px-3 py-1.5 leading-snug print:px-1.5 print:py-0 print:leading-[1.35]", RULE, struck && "line-through")}>
        {item.critical && (
          <span className="mr-1 text-destructive" aria-label="Punto crítico">
            ★
          </span>
        )}
        <span className="sr-only">{number} </span>
        {item.label}
      </td>
      <td className={cn("border p-0 text-center", RULE)}>
        <Box checked={!struck && status === "BIEN"} label="BIEN" />
      </td>
      <td className={cn("border p-0 text-center", RULE)}>
        <Box checked={!struck && status === "MAL"} label="MAL" />
      </td>
    </tr>
  );
}

/** A letter-proportioned white sheet; on paper each one is exactly one page. */
function Page({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <section
        className={cn(
          "mx-auto flex w-full max-w-[8.5in] min-w-[44rem] flex-col gap-4 border bg-white p-6 text-sm text-black shadow-sm sm:p-8 lg:min-h-[11in]",
          "print:min-h-0 print:max-w-none print:gap-2 print:border-0 print:p-0 print:text-[9px] print:shadow-none",
          !last && "print:break-after-page",
          EXACT,
        )}
      >
        {children}
      </section>
    </div>
  );
}

function SheetHeading({ children }: { children: ReactNode }) {
  return <h2 className={cn("border-b-2 pb-1 text-base font-bold uppercase print:pb-0.5 print:text-[11px]", RULE)}>{children}</h2>;
}

/** A label cell and its value cell, side by side like the PDF's data grid. */
function GridPair({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <>
      <div className={cn(LABEL_CELL, "flex items-center print:py-1")}>{label}</div>
      <div className={cn("flex min-h-10 items-center border px-3 py-1 break-words print:min-h-0 print:px-1.5 print:py-0.5", RULE)}>{children}</div>
    </>
  );
}

const MIN_NOVEDAD_ROWS = 7;

/**
 * One saved inspection laid out like the two-page paper form FO-PESV-016. On screen each page is a
 * white sheet; when printed (letter) the app chrome is hidden and only the two pages remain.
 */
export function InspectionSheet({
  inspection,
  canDecide,
  defaults,
}: {
  inspection: InspectionDetail;
  /** Inspections managers only: shows the decision / closure controls instead of the read-only summary. */
  canDecide: boolean;
  defaults: { date: string; time: string };
}) {
  const { answers, exit, closure } = inspection;
  const failedItems = hasFailedItems(answers);
  const decision: ExitPanelProps["decision"] = inspection.exitDecision
    ? {
        value: inspection.exitDecision,
        authorizedTime: exit?.authorizedTime ?? null,
        signoff: formatSignoff(exit?.decidedByName ?? null, exit?.decidedAt ?? null),
      }
    : null;
  const closureView: ExitPanelProps["closure"] = closure
    ? {
        date: closure.date,
        workOrder: closure.workOrder,
        action: closure.action,
        responsible: closure.responsible,
        signoff: formatSignoff(closure.recordedByName, closure.recordedAt),
      }
    : null;
  const exitProps: ExitPanelProps = {
    inspectionId: inspection.id,
    inspectionDate: inspection.inspectionDate,
    hasCriticalFailure: inspection.hasCriticalFailure,
    hasFailedItems: failedItems,
    decision,
    closure: closureView,
    defaults,
  };
  const [authorizedHours = "", authorizedMinutes = ""] = (decision?.authorizedTime ?? "").split(":");
  const [closureYear = "", closureMonth = "", closureDay = ""] = (closure?.date ?? "").split("-");
  const unchecked = uncheckedCount(answers, inspection.muleNotApplicable);
  const failures: { number: string; item: ChecklistItem; note: string }[] = [];
  PREOPERATIONAL_CHECKLIST.forEach((section, si) =>
    section.items.forEach((item, ii) => {
      const answer = answers[item.id];
      if (answer?.status === "MAL") failures.push({ number: itemNumber(si, ii), item, note: answer.note ?? "" });
    }),
  );

  const checklistColumn = (from: number, to: number) => (
    <ChecklistTable
      sections={PREOPERATIONAL_CHECKLIST.slice(from, to)}
      offset={from}
      sectionHint={(section) => (section.muleOnly ? "si no aplica, raye" : section.hint)}
      renderBody={(section, sectionIndex) =>
        section.items.map((item, ii) => (
          <SheetRow
            key={item.id}
            item={item}
            number={itemNumber(sectionIndex, ii)}
            status={answers[item.id]?.status}
            struck={Boolean(section.muleOnly && inspection.muleNotApplicable)}
          />
        ))
      }
    />
  );

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/preoperacionales" className={buttonVariants({ variant: "ghost", className: "h-11 px-3 md:h-10" })}>
          <ArrowLeft aria-hidden />
          Preoperacionales
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canDecide && (
            <DeleteInspectionButton
              inspectionId={inspection.id}
              summary={`${inspection.plate} · ${formatInspectionDate(inspection.inspectionDate)} ${inspection.inspectionTime}`}
              afterDelete="/preoperacionales"
            />
          )}
          <PrintButton />
        </div>
      </div>

      <RegisteredLinks inspection={inspection} />

      {canDecide ? <ExitPanel {...exitProps} /> : <ExitSummary {...exitProps} />}

      <div
        className={
          inspection.hasCriticalFailure
            ? "rounded-lg bg-danger px-3 py-2 text-center font-bold text-danger-foreground uppercase print:hidden"
            : "rounded-lg bg-ok px-3 py-2 text-center font-bold text-ok-foreground uppercase print:hidden"
        }
      >
        {inspection.hasCriticalFailure ? "Punto crítico en MAL: el vehículo no sale" : "Sin puntos críticos en MAL"}
      </div>
      {unchecked > 0 && (
        <p className="text-center text-sm print:hidden">
          {unchecked} {unchecked === 1 ? "punto sin revisar" : "puntos sin revisar"}
        </p>
      )}

      <div className="space-y-6 print:space-y-0">
        <Page>
          <SheetHeader page="1 de 2" />

          <section aria-label="Datos de la inspección" className={cn("grid grid-cols-[auto_1fr_auto_1fr] border-2", RULE)}>
            <GridPair label="Fecha">{formatSheetDate(inspection.inspectionDate)}</GridPair>
            <GridPair label="Hora">{formatSheetTime(inspection.inspectionTime)}</GridPair>
            <GridPair label="Placa">{inspection.plate}</GridPair>
            <GridPair label="Placa remolque">{inspection.trailerPlate}</GridPair>
            <GridPair label="Conductor">{inspection.driverName}</GridPair>
            <GridPair label="Cédula">{inspection.driverNationalId}</GridPair>
            <GridPair label="Kilometraje">{inspection.odometer}</GridPair>
            <GridPair label="Ruta / destino">{inspection.route}</GridPair>
          </section>

          <FillingInstructions />

          <div className="grid grid-cols-2 items-start gap-4 print:gap-2">
            {checklistColumn(0, LEFT_COLUMN_SECTIONS)}
            {checklistColumn(LEFT_COLUMN_SECTIONS, PREOPERATIONAL_CHECKLIST.length)}
          </div>

          <p className="mt-auto flex justify-between gap-4 text-sm print:text-[8px]">
            <span>
              <span className="text-destructive">★</span> Punto crítico: si está MAL el vehículo no sale.
            </span>
            <span>Continúa al respaldo →</span>
          </p>
        </Page>

        <Page last>
          <SheetHeader page="2 de 2" />

          <section className="space-y-2">
            <SheetHeading>Novedades</SheetHeading>
            <p>
              Escriba qué está MAL y dónde. Ejemplo: <em>&quot;4 – llanta trasera derecha con corte&quot;</em>.
            </p>
            <table className={cn("w-full border-collapse border-2", RULE)}>
              <thead>
                <tr>
                  <th scope="col" className={cn(LABEL_CELL, "w-24 text-left")}>
                    N.º punto
                  </th>
                  <th scope="col" className={cn(LABEL_CELL, "text-left")}>
                    Qué encontré
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(MIN_NOVEDAD_ROWS, failures.length) }, (_, i) => {
                  const failure = failures[i];
                  return (
                    <tr key={failure?.item.id ?? `blank-${i}`} className="break-inside-avoid">
                      <td className={cn("h-9 border px-3 py-1 align-top font-bold print:h-7", RULE)}>{failure?.number}</td>
                      <td className={cn("border px-3 py-1 align-top break-words", RULE)}>{failure?.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="space-y-2">
            <SheetHeading>
              Decisión de salida <span className="font-normal normal-case">(solo la marca la Jefe de Mantenimiento)</span>
            </SheetHeading>
            <div className="grid grid-cols-2 gap-3">
              <div className={cn("flex items-start gap-3 border-2 bg-ok p-3", RULE)}>
                <Box checked={inspection.exitDecision === "APTO"} label="APTO PARA SALIR" />
                <p>
                  <strong>APTO PARA SALIR</strong>
                  <br />
                  Revisado y autorizado por la Jefe de Mantenimiento.
                </p>
              </div>
              <div className={cn("flex items-start gap-3 border-2 bg-danger p-3", RULE)}>
                <Box checked={inspection.exitDecision === "NO_APTO"} label="NO APTO" />
                <p>
                  <strong>NO APTO</strong>
                  <br />
                  Queda en mantenimiento hasta nueva autorización.
                </p>
              </div>
            </div>
            {decision && (
              <p className="font-bold print:text-[8px]">
                Autorizado por {formatSignoff(exit?.decidedByName ?? null, exit?.decidedAt ?? null)}
              </p>
            )}
            <p className="border-2 border-destructive p-2 text-center font-bold">
              Sin autorización de la Jefe de Mantenimiento, Ibon Rocío García Melo, el vehículo NO sale.
            </p>
          </section>

          <section className="space-y-2">
            <SheetHeading>Firmas</SheetHeading>
            <div className="grid grid-cols-2 items-end gap-6">
              <div>
                {/* A data URL the server validated as a PNG: nothing to optimize or fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspection.signature}
                  alt={`Firma de ${inspection.driverName}`}
                  className="h-24 w-auto max-w-full bg-white print:h-20"
                />
                <div className={cn("border-t-2 pt-1", RULE)}>
                  <p className="font-bold">Firma del conductor</p>
                  <p>Nombre: {inspection.driverName}</p>
                </div>
              </div>
              <p className="whitespace-nowrap">
                <span className="font-bold">Hora de salida autorizada</span>{" "}
                <span className={cn("inline-block min-w-12 border-b-2 text-center align-bottom font-bold", RULE)}>
                  {authorizedHours}
                </span>{" "}
                :{" "}
                <span className={cn("inline-block min-w-12 border-b-2 text-center align-bottom font-bold", RULE)}>
                  {authorizedMinutes}
                </span>
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <SheetHeading>
              Cierre de la novedad <span className="font-normal normal-case">(lo llena mantenimiento)</span>
            </SheetHeading>
            <div className={cn("grid grid-cols-[auto_1fr_auto_1fr] border-2", RULE)}>
              <div className={cn(LABEL_CELL, "flex items-center")}>Fecha de cierre</div>
              <div className={cn("flex items-center border px-3", RULE)}>
                {closure ? closureDay + " / " + closureMonth + " / " + closureYear : "___ / ___ / ______"}
              </div>
              <div className={cn(LABEL_CELL, "flex items-center")}>Orden de trabajo N.º</div>
              <div className={cn("flex min-h-10 items-center border px-3 break-words", RULE)}>{closure?.workOrder}</div>
              <div className={cn(LABEL_CELL, "flex items-center")}>Qué se hizo</div>
              <div className={cn("col-span-3 min-h-16 border px-3 py-1 break-words print:min-h-12 print:py-0.5", RULE)}>
                {closure?.action}
              </div>
              <div className={cn(LABEL_CELL, "flex items-center")}>Responsable</div>
              <div className={cn("flex min-h-10 items-center border px-3 break-words", RULE)}>{closure?.responsible}</div>
              <div className={cn(LABEL_CELL, "flex items-center")}>Firma</div>
              <div className={cn("flex min-h-10 items-center border px-3 break-words", RULE)}>
                {closure && formatSignoff(closure.recordedByName, closure.recordedAt, true)}
              </div>
            </div>
          </section>

          <footer className="mt-auto space-y-1 text-xs print:text-[9px]">
            <p>
              Respaldo normativo: Resolución 20223040040595 de 2022 (PESV) — Paso 16, inspección preoperacional diaria;
              Paso 17, mantenimiento preventivo; Paso 19, conservación de registros por un (1) año. Ley 769 de 2002,
              artículo 30 — equipo de prevención y seguridad (sección 11).
            </p>
            <p>Archivo: este formato se guarda por placa y se conserva mínimo un (1) año.</p>
          </footer>
        </Page>
      </div>
    </article>
  );
}
