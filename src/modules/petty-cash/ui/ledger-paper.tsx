import { formatPrice } from "@/modules/sales/domain/sale-row";
import { formatDisplayDate } from "@/modules/shared/domain/dates";
import { isExpensePending, RESPONSIBILITY_LABELS } from "../domain/expense";
import { formatSheetDate } from "../domain/ledger-date";
import { formatNit } from "../domain/nit";
import type { ExpenseRow, LedgerSheet } from "../domain/petty-cash-rows";

/** The sheet colors come from the app theme tokens, so they follow the user's theme on screen and on paper. */
const C = {
  ink: "var(--card-foreground)",
  // Labels use the full foreground: muted ink on muted fills read too faint.
  inkSoft: "var(--foreground)",
  bar: "var(--primary)",
  barInk: "var(--primary-foreground)",
  band: "var(--muted)",
  // Column headers: dark strip with light text, the strongest contrast on the sheet.
  header: "var(--foreground)",
  headerInk: "var(--card)",
  zebra: "color-mix(in oklab, var(--muted) 55%, var(--card))",
  dateBg: "var(--secondary)",
  dateInk: "var(--secondary-foreground)",
  electronicBg: "var(--warn)",
  electronicInk: "var(--warn-foreground)",
  danger: "var(--destructive)",
  // Rows read by the AI and not reviewed yet: the amber status color, softened so the ink stays readable.
  reviewBg: "color-mix(in oklab, var(--warn) 45%, var(--card))",
  reviewInk: "var(--warn-foreground)",
} as const;

const CELL = "border px-3 py-1.5 align-middle";
const HEAD = "border px-3 py-2 text-center text-[11px] font-bold tracking-wide";
const EXACT = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";
const COLUMNS = ["DETALLE", "Nº FACTURA", "NIT", "EMPRESA", "EFK", "TIPO RESPONSABILIDAD", "VEHICULO", "VALOR"] as const;

function ExpenseLine({ row, striped }: { row: ExpenseRow; striped: boolean }) {
  const pending = isExpensePending(row);
  const electronic = row.responsibilityType === "electronic_invoicer";
  const background = row.needsReview ? C.reviewBg : striped ? C.zebra : undefined;
  return (
    <tr style={background ? { backgroundColor: background } : undefined}>
      <td className={CELL}>
        {row.detail}
        {(row.needsReview || row.possibleDuplicate) && (
          <span className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-semibold tracking-wide uppercase">
            {row.needsReview && (
              <span className="rounded px-1.5 py-px" style={{ backgroundColor: C.reviewInk, color: C.reviewBg }}>
                Por revisar
              </span>
            )}
            {row.possibleDuplicate && (
              <span className="rounded border px-1.5 py-px" style={{ borderColor: C.danger, color: C.danger }}>
                Posible duplicado
              </span>
            )}
          </span>
        )}
      </td>
      <td className={`${CELL} text-center`}>{row.invoiceNumber}</td>
      <td
        className={`${CELL} num whitespace-nowrap text-center`}
        style={pending ? { color: C.danger, fontWeight: 700 } : undefined}
        title={pending ? "Falta NIT, empresa o tipo de responsabilidad" : undefined}
      >
        {row.nit ? formatNit(row.nit) : ""}
      </td>
      <td className={`${CELL} font-medium`}>{row.company}</td>
      <td className={`${CELL} text-center`}>{row.efk}</td>
      <td className={`${CELL} text-center text-[11px]`}>
        {row.responsibilityType && (
          <span
            className="inline-block rounded px-1.5 py-0.5 font-medium"
            style={electronic ? { backgroundColor: C.electronicBg, color: C.electronicInk } : { color: C.inkSoft }}
          >
            {RESPONSIBILITY_LABELS[row.responsibilityType]}
          </span>
        )}
      </td>
      <td className={`${CELL} text-center font-semibold`}>{row.vehicleLabel}</td>
      <td className={`${CELL} num whitespace-nowrap text-right font-medium`}>{row.value === null ? "—" : formatPrice(row.value)}</td>
    </tr>
  );
}

/**
 * The ledger as the paper form (what the accountant knows from the Excel file). It is what prints, so
 * it stays in the page even when another view is on screen.
 */
export function LedgerPaper({ balance, expenses, ownerName }: { balance: LedgerSheet["balance"]; expenses: readonly ExpenseRow[]; ownerName: string }) {
  return (
  <div
    className={`overflow-x-auto rounded-lg border bg-card p-3 text-[13px] [&_td]:border-input [&_th]:border-input print:overflow-visible print:rounded-none print:border-0 print:p-0 print:text-[11px] ${EXACT}`}
    style={{ color: C.ink }}
  >
    <table className="w-full min-w-[56rem] border-collapse print:min-w-0">
      <caption className="sr-only">Planilla de caja del {formatDisplayDate(balance.date)}</caption>
      <thead>
        <tr>
          <th
            colSpan={8}
            className="border px-3 py-3 text-center text-base font-bold tracking-wider"
            style={{ backgroundColor: C.bar, color: C.barInk }}
          >
            COMERCIALIZADORA EL IMPERIO {ownerName}
          </th>
        </tr>
        <tr>
          <td colSpan={3} rowSpan={2} className="border-0 p-0 align-top">
            <table className="w-full border-collapse">
              <tbody>
                {[
                  ["SALDO INICIAL", balance.openingBalance],
                  ["COMPENSE", balance.compenseAmount],
                  ["TOTAL", balance.total],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <th
                      scope="row"
                      className="border px-3 py-1.5 text-left text-[11px] font-semibold tracking-wide"
                      style={{ backgroundColor: C.band, color: C.inkSoft }}
                    >
                      {label}
                    </th>
                    <td className={`num border px-3 py-1.5 text-right ${label === "TOTAL" ? "font-bold" : "font-medium"}`}>
                      {formatPrice(Number(value))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
          <td
            colSpan={5}
            className="border px-3 py-2 text-center text-lg font-bold tracking-wide"
            style={{ backgroundColor: C.dateBg, color: C.dateInk }}
          >
            {formatSheetDate(balance.date)}
          </td>
        </tr>
        <tr>
          <td
            colSpan={5}
            className="border px-3 py-1.5 text-center text-xs font-semibold tracking-[0.2em]"
            style={{ backgroundColor: C.band, color: C.inkSoft }}
          >
            GASTOS / EGRESOS
          </td>
        </tr>
        <tr style={{ backgroundColor: C.header, color: C.headerInk }}>
          {COLUMNS.map((c) => (
            <th key={c} scope="col" className={HEAD}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {expenses.length === 0 ? (
          <tr>
            <td colSpan={8} className={`${CELL} py-6 text-center`} style={{ color: C.inkSoft }}>
              Aún no hay gastos en esta planilla.
            </td>
          </tr>
        ) : (
          expenses.map((e, i) => (
            <ExpenseLine key={e.id} row={e} striped={i % 2 === 1} />
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          <th
            scope="row"
            colSpan={7}
            className="border px-3 py-2 text-right text-xs font-semibold tracking-wide"
            style={{ backgroundColor: C.band, color: C.inkSoft }}
          >
            TOTAL GASTOS
          </th>
          <td className="num border px-3 py-2 text-right font-bold" style={{ backgroundColor: C.band }}>
            {formatPrice(balance.totalExpenses)}
          </td>
        </tr>
        <tr>
          <th
            scope="row"
            colSpan={7}
            className="border px-3 py-2.5 text-right text-xs font-semibold tracking-wide"
            style={{ backgroundColor: C.bar, color: C.barInk }}
          >
            SALDO FINAL
          </th>
          <td
            className="num border px-3 py-2.5 text-right text-base font-bold"
            style={{
              backgroundColor: C.bar,
              color: balance.closingBalance < 0 ? C.danger : C.barInk,
            }}
          >
            {formatPrice(balance.closingBalance)}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  );
}
