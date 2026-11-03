import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  FORM_CODE,
  FORM_VERSION,
  PREOPERATIONAL_CHECKLIST,
  itemNumber,
  sectionNumber,
  type ChecklistItem,
} from "../domain/preoperational-checklist";
import type { InspectionDetail } from "../infrastructure/inspection-repository";
import { formatInspectionDate } from "./inspection-format";
import { PrintButton } from "./print-button";

const SENT_AT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "short",
  timeStyle: "short",
});

const CELL = "border border-foreground/60 px-2 py-1 print:border-black";

function Data({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={CELL}>
      <p className="micro-label print:text-black">{label}</p>
      <p className="mt-1 font-medium break-words">{children}</p>
    </div>
  );
}

/**
 * One saved inspection laid out like the paper form FO-PESV-016. On screen it sits in the app; when
 * printed the app chrome is hidden (see the `print:` rules of the shell) and only the sheet remains.
 */
export function InspectionSheet({ inspection }: { inspection: InspectionDetail }) {
  const { answers } = inspection;
  const failures: { number: string; item: ChecklistItem; note: string }[] = [];
  PREOPERATIONAL_CHECKLIST.forEach((section, si) =>
    section.items.forEach((item, ii) => {
      const answer = answers[item.id];
      if (answer?.status === "MAL") failures.push({ number: itemNumber(si, ii), item, note: answer.note ?? "" });
    }),
  );

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/preoperacionales"
          className={buttonVariants({ variant: "ghost", className: "h-11 px-3 md:h-10" })}
        >
          <ArrowLeft aria-hidden />
          Preoperacionales
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto w-full max-w-4xl bg-card text-sm text-card-foreground print:max-w-none print:bg-white print:text-[11px] print:text-black">
        <div className="grid grid-cols-[1fr_auto] border border-foreground/60 print:border-black sm:grid-cols-[1fr_2fr_auto]">
          <p className={`${CELL} hidden items-center font-bold sm:flex`}>Transportes El Imperio</p>
          <h1 className={`${CELL} flex items-center justify-center text-center text-base font-bold uppercase`}>
            Inspección preoperacional diaria del vehículo
          </h1>
          <div className={`${CELL} space-y-0.5 whitespace-nowrap`}>
            <p>
              <span className="font-semibold">Código:</span> {FORM_CODE}
            </p>
            <p>
              <span className="font-semibold">Versión:</span> {FORM_VERSION}
            </p>
          </div>
        </div>

        <div
          className={
            inspection.hasCriticalFailure
              ? "border border-t-0 border-foreground/60 bg-danger px-3 py-2 text-center font-bold text-danger-foreground uppercase print:border-black print:bg-white print:text-black"
              : "border border-t-0 border-foreground/60 bg-ok px-3 py-2 text-center font-bold text-ok-foreground uppercase print:border-black print:bg-white print:text-black"
          }
        >
          {inspection.hasCriticalFailure ? "Punto crítico en MAL: el vehículo no sale" : "Sin puntos críticos en MAL"}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4">
          <Data label="Fecha">{formatInspectionDate(inspection.inspectionDate)}</Data>
          <Data label="Hora">{inspection.inspectionTime}</Data>
          <Data label="Placa">{inspection.plate}</Data>
          <Data label="Placa remolque">{inspection.trailerPlate ?? "—"}</Data>
          <Data label="Conductor">{inspection.driverName}</Data>
          <Data label="Cédula">{inspection.driverNationalId}</Data>
          <Data label="Kilometraje">{inspection.odometer}</Data>
          <Data label="Ruta / destino">{inspection.route}</Data>
        </div>

        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-muted/60 text-left print:bg-white">
              <th scope="col" className={`${CELL} w-12`}>
                N.°
              </th>
              <th scope="col" className={CELL}>
                Ítem
              </th>
              <th scope="col" className={`${CELL} w-14 text-center`}>
                BIEN
              </th>
              <th scope="col" className={`${CELL} w-14 text-center`}>
                MAL
              </th>
            </tr>
          </thead>
          {PREOPERATIONAL_CHECKLIST.map((section, si) => (
            <tbody key={section.id} className="break-inside-avoid">
              <tr className="bg-muted/40 print:bg-white">
                <th scope="colgroup" colSpan={4} className={`${CELL} text-left uppercase`}>
                  {sectionNumber(si)}. {section.title}
                  {section.hint && <span className="font-normal normal-case"> ({section.hint})</span>}
                </th>
              </tr>
              {section.muleOnly && inspection.muleNotApplicable ? (
                <tr>
                  <td colSpan={4} className={`${CELL} italic`}>
                    No aplica (el vehículo no es mula)
                  </td>
                </tr>
              ) : (
                section.items.map((item, ii) => {
                  const status = answers[item.id]?.status;
                  return (
                    <tr key={item.id} className="break-inside-avoid">
                      <td className={`${CELL} num`}>{itemNumber(si, ii)}</td>
                      <td className={CELL}>
                        {item.critical && (
                          <span aria-label="Punto crítico" className="mr-1 font-bold">
                            ★
                          </span>
                        )}
                        {item.label}
                      </td>
                      <td className={`${CELL} text-center font-bold`}>
                        {status === "BIEN" && <span aria-label="BIEN">X</span>}
                      </td>
                      <td className={`${CELL} text-center font-bold`}>
                        {status === "MAL" && <span aria-label="MAL">X</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          ))}
        </table>

        <section className="mt-3 break-inside-avoid border border-foreground/60 p-2 print:border-black">
          <h2 className="micro-label print:text-black">Novedades</h2>
          {failures.length === 0 ? (
            <p className="mt-1">Sin novedades.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {failures.map(({ number, item, note }) => (
                <li key={item.id}>
                  <span className="num font-semibold">{number}</span> {item.critical && "★ "}
                  {item.label}: <span className="break-words">{note}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-3 break-inside-avoid border border-foreground/60 p-2 print:border-black">
          <h2 className="micro-label print:text-black">Firma del conductor</h2>
          {/* A data URL the server validated as a PNG: nothing to optimize or fetch. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inspection.signature}
            alt={`Firma de ${inspection.driverName}`}
            className="mt-1 h-28 w-auto max-w-full border-b border-foreground/60 bg-white print:border-black"
          />
          <p className="mt-1 font-medium">{inspection.driverName}</p>
          <p className="num">C.C. {inspection.driverNationalId}</p>
        </section>

        <p className="mt-2 text-xs text-muted-foreground print:text-black">
          Enviada el {SENT_AT.format(inspection.createdAt)} (hora de Colombia).
        </p>
      </div>
    </article>
  );
}
