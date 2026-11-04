import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  FORM_CODE,
  FORM_ISSUED,
  FORM_VERSION,
  sectionNumber,
  type ChecklistSection,
} from "../domain/preoperational-checklist";

/**
 * Pieces of the paper form FO-PESV-016 shared by the public form (inputs) and the saved-inspection
 * sheet (static): the same header, instructions box and checklist table, so both look like the PDF.
 */

// The paper form's grid: dark rules, grey label cells.
export const RULE = "border-foreground/70 print:border-black";
export const LABEL_CELL = cn("border bg-muted px-3 py-2 text-sm font-bold print:px-1.5 print:py-0.5 print:text-[9px]", RULE);

// Sections 1–7 sit in the left column of the paper form, 8–13 in the right one.
export const LEFT_COLUMN_SECTIONS = 7;

/** Header box: program line, title and the Código / Versión / Emisión (/ Página) table. */
export function SheetHeader({ page }: { page?: string }) {
  const rows = [
    ["Código", FORM_CODE],
    ["Versión", FORM_VERSION],
    ["Emisión", FORM_ISSUED],
    ...(page ? [["Página", page]] : []),
  ];
  return (
    <header className={cn("grid border-2 sm:grid-cols-[1fr_auto]", RULE)}>
      <div className="flex items-center p-3 print:px-2 print:py-1">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground uppercase print:text-[7px] print:text-black">
            Plan estratégico de seguridad vial · Paso 16
          </p>
          <h1 className="mt-1 text-lg leading-tight font-bold uppercase sm:text-xl print:mt-0.5 print:text-[13px]">
            Inspección preoperacional diaria de vehículos
          </h1>
        </div>
      </div>
      <dl className={cn("grid grid-cols-[auto_1fr] border-t text-sm sm:border-t-0 sm:border-l print:text-[8px]", RULE)}>
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className={cn("border-b bg-muted px-3 py-1.5 font-bold last:border-b-0 print:px-1.5 print:py-px", RULE)}>{term}</dt>
            <dd className={cn("border-b border-l px-3 py-1.5 print:px-1.5 print:py-px", RULE)}>{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** The yellow "how to fill it" box. */
export function FillingInstructions() {
  return (
    <div className={cn("border-2 bg-warn/50 p-4 text-base leading-snug print:px-2 print:py-1 print:text-[8.5px] print:leading-tight", RULE)}>
      <p className="font-bold">Cómo llenarlo — antes de salir y con el vehículo enfrente:</p>
      <ol className="mt-1 list-decimal space-y-0.5 pl-6 print:mt-0 print:space-y-0 print:pl-4">
        <li>
          Marque <strong>X</strong> en <strong>BIEN</strong> o en <strong>MAL</strong>. Los puntos críticos (
          <span className="text-destructive">★</span>) son obligatorios; marque también los demás que pueda revisar.
        </li>
        <li>
          Si un <strong>PUNTO CRÍTICO</strong> (<span className="text-destructive">★</span>) está en{" "}
          <strong>MAL</strong>, el vehículo <strong>NO SALE</strong>: avise al despachador y a la Jefe de Mantenimiento.
        </li>
        <li>
          Escriba lo que esté MAL en <strong>Novedades</strong> y firme.
        </li>
      </ol>
    </div>
  );
}

/**
 * One column of the checklist: dark header row, grey section rows, then whatever `renderBody` gives
 * for each section (item rows). `offset` is the index of the first section, for the numbering.
 */
export function ChecklistTable({
  sections,
  offset,
  renderBody,
  sectionExtra,
  sectionHint = (section) => section.hint,
}: {
  sections: readonly ChecklistSection[];
  offset: number;
  renderBody: (section: ChecklistSection, sectionIndex: number) => ReactNode;
  /** Extra content inside the grey section row (the form's "no aplica" checkbox). */
  sectionExtra?: (section: ChecklistSection) => ReactNode;
  sectionHint?: (section: ChecklistSection) => string | undefined;
}) {
  return (
    <table className={cn("w-full border-collapse border-2 text-base print:text-[9px]", RULE)}>
      <thead>
        <tr className="bg-foreground text-background print:bg-black print:text-white">
          <th scope="col" className="px-3 py-2 text-left text-sm font-bold print:px-1.5 print:py-0.5 print:text-[9px]">
            Punto a revisar
          </th>
          <th scope="col" className="w-14 px-1 py-2 text-center text-sm font-bold print:w-9 print:py-0.5 print:text-[9px]">
            BIEN
          </th>
          <th scope="col" className="w-14 px-1 py-2 text-center text-sm font-bold print:w-9 print:py-0.5 print:text-[9px]">
            MAL
          </th>
        </tr>
      </thead>
      {sections.map((section, i) => {
        const sectionIndex = offset + i;
        const hint = sectionHint(section);
        return (
          <tbody key={section.id} className="break-inside-avoid">
            <tr>
              <th scope="colgroup" colSpan={3} className={cn(LABEL_CELL, "text-left uppercase")}>
                {sectionNumber(sectionIndex)}. {section.title}
                {hint && <span className="ml-1 font-normal normal-case">({hint})</span>}
                {sectionExtra?.(section)}
              </th>
            </tr>
            {renderBody(section, sectionIndex)}
          </tbody>
        );
      })}
    </table>
  );
}
