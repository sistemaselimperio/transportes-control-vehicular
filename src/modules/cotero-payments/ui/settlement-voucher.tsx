import type { CSSProperties } from "react";
import type { SettlementVoucher as Voucher } from "../domain/settlement-voucher";

const SERIF = 'Georgia, "Times New Roman", serif';
const HEAD_BG = "#1f2328";
const UNIT_PRICE_BG = "#dbeaf3";
const HIGHLIGHT_BG = "#f2c200";

/** Exact colors on paper: browsers drop backgrounds when printing unless told otherwise. */
const EXACT: CSSProperties = { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" };

const CELL = "border border-black px-2 py-1.5 text-[13px] leading-tight";

/** The settlement voucher a cotero signs: the same sheet as the Excel one, laid out to print on a letter page. */
export function SettlementVoucher({ voucher }: { voucher: Voucher }) {
  const { lines } = voucher;
  return (
    <article className="mx-auto w-full max-w-[190mm] bg-white p-4 text-black print:max-w-none print:p-0" style={{ ...EXACT, fontFamily: SERIF }}>
      <table className="w-full table-fixed border-collapse border border-black" style={EXACT}>
        <colgroup>
          <col style={{ width: "26%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "19%" }} />
        </colgroup>
        <tbody>
          <tr>
            <th colSpan={5} className={`${CELL} py-2.5 text-center text-base font-bold`}>
              LIQUIDACIÓN DE CARGUE Y DESCARGUE
            </th>
          </tr>
          <tr>
            <td className={`${CELL} font-bold`}>Señores:</td>
            <td colSpan={2} className={`${CELL} font-bold`}>
              {voucher.coteroName}
            </td>
            <td className={`${CELL} font-bold`}>Fecha:</td>
            <td className={CELL}>{voucher.date}</td>
          </tr>
          <tr>
            <td className={`${CELL} font-bold`}>NIT / C.C.:</td>
            <td colSpan={4} className={CELL}>
              {voucher.document}
            </td>
          </tr>
          <tr style={{ backgroundColor: HEAD_BG, color: "#fff", ...EXACT }}>
            {["DESCRIPCIÓN", "FECHA", "UNIDADES", "VALOR UNITARIO", "VALOR TOTAL"].map((label) => (
              <th key={label} className={`${CELL} text-center font-bold`} style={{ backgroundColor: HEAD_BG, ...EXACT }}>
                {label}
              </th>
            ))}
          </tr>
          {(lines.length > 0 ? lines : [null]).map((line, i) => (
            <tr key={i}>
              {i === 0 && (
                <td rowSpan={Math.max(lines.length, 1)} className={`${CELL} text-center font-bold`}>
                  SERVICIO CARGUE Y DESCARGUE
                </td>
              )}
              <td className={`${CELL} text-center`}>{line?.day}</td>
              <td className={`${CELL} text-right`}>{line?.units}</td>
              <td className={`${CELL} text-right`} style={{ backgroundColor: UNIT_PRICE_BG, ...EXACT }}>
                {line?.unitPrice}
              </td>
              <td className={`${CELL} text-right`}>{line?.total}</td>
            </tr>
          ))}
          <tr>
            <td className={CELL} />
            <td className={`${CELL} text-center font-bold`}>TOTAL</td>
            <td className={`${CELL} text-right font-bold`} style={{ backgroundColor: HIGHLIGHT_BG, ...EXACT }}>
              {voucher.totalUnits}
            </td>
            <td className={CELL} />
            <td className={CELL} />
          </tr>
          <tr>
            <td colSpan={3} className={`${CELL} font-bold`}>
              PAGO: {voucher.payment}
            </td>
            <td className={`${CELL} text-center font-bold`}>NETO A PAGAR</td>
            <td className={`${CELL} text-right font-bold`} style={{ backgroundColor: HIGHLIGHT_BG, ...EXACT }}>
              {voucher.totalAmount}
            </td>
          </tr>
          <tr>
            <td className={`${CELL} font-bold`}>SON:</td>
            <td colSpan={4} className={`${CELL} text-center font-bold uppercase`}>
              {voucher.amountInWords}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-24 w-72 border-t border-black pt-1 text-[13px] leading-snug">
        <p className="font-bold">Firma del cotero</p>
        <p className="mt-1">C.C. {voucher.document || "______________________"}</p>
      </div>
    </article>
  );
}
